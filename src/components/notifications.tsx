import { thumbSrc } from "@/utils/thumbSrc";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, PlayCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useNotifPrefsStore } from "@/store/notifPrefsStore";


export type Notification = {
  id: string;
  type: "new_episode" | "recommendation" | "system";
  movie_slug: string;
  movie_name: string;
  movie_thumb: string;
  episode?: string;
  message: string;
  createdAt: number;
  read: boolean;
};

export function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ngày trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}

/**
 * Canonical notification copy:
 *   new_episode → "{title} · Tập {ep} đã lên · {relativeTime}"
 *   others      → falls back to the server-provided message.
 * Kept as a single helper so bell dropdown, full page, and toast agree.
 */
export function formatNotificationCopy(n: Notification): {
  headline: string;
  meta: string;
} {
  if (n.type === "new_episode" && n.episode) {
    return {
      headline: n.movie_name,
      meta: `Tập ${n.episode} đã lên · ${formatRelative(n.createdAt)}`,
    };
  }
  return {
    headline: n.movie_name,
    meta: `${n.message} · ${formatRelative(n.createdAt)}`,
  };
}

/** Slugs a user is "following" for notification purposes = watchlist ∪ history. */
type FollowResp = { items: { movie_slug?: string; slug?: string }[] };

function useFollowedSlugs() {
  const wl = useQuery<FollowResp>({
    queryKey: ["notif", "follow", "watchlist"],
    queryFn: async () => (await fetch("/api/watchlist")).json(),
    staleTime: 60_000,
  });
  const hist = useQuery<FollowResp>({
    queryKey: ["notif", "follow", "history"],
    queryFn: async () => (await fetch("/api/history")).json(),
    staleTime: 60_000,
  });
  return useMemo(() => {
    const set = new Set<string>();
    for (const it of wl.data?.items ?? []) {
      const s = it.movie_slug ?? it.slug;
      if (s) set.add(s);
    }
    for (const it of hist.data?.items ?? []) {
      const s = it.slug ?? it.movie_slug;
      if (s) set.add(s);
    }
    return set;
  }, [wl.data, hist.data]);
}

type NotificationsResp = { items: Notification[] };

/**
 * Notifications feed with two filters applied on top of the raw store:
 * 1. `new_episode` items are dropped when the slug is NOT followed
 *    (watchlist ∪ history) — no spam for shows the user never asked for.
 * 2. Any type disabled in the preference center is hidden entirely.
 */
export function useNotifications() {
  const followed = useFollowedSlugs();
  const prefs = useNotifPrefsStore();
  const q = useQuery<NotificationsResp>({
    queryKey: ["notifications"],
    queryFn: async () => (await fetch("/api/notifications")).json(),
  });

  const items = useMemo(() => {
    const raw = q.data?.items ?? [];
    return raw.filter((n) => {
      if (!prefs[n.type]) return false;
      if (n.type === "new_episode" && !followed.has(n.movie_slug)) return false;
      return true;
    });
  }, [q.data, followed, prefs]);

  return { ...q, data: q.data ? { items } : q.data, rawCount: q.data?.items.length ?? 0 };
}

/**
 * Unread count derived from the filtered feed so the bell badge and the
 * dropdown can never disagree. The underlying query still polls every
 * 60s to trigger a re-derive when the server store changes.
 */
export function useUnreadCount() {
  const { data } = useNotifications();
  const server = useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await fetch("/api/notifications/unread-count")).json(),
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 60_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const count = (data?.items ?? []).filter((n) => !n.read).length;
  return { data: { count }, isLoading: server.isLoading };
}


/**
 * Watches the unread-count query and fires a toast + returns a "bump" pulse
 * whenever the count increases (new notifications arrived while polling).
 */
function useNotificationAlerts(count: number, items: Notification[]) {
  const prevRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = count;
    if (prev == null) return; // first read — no baseline yet
    if (count > prev) {
      setBump((b) => b + 1);
      const latest = items.find((n) => !n.read);
      const title = latest ? `${latest.movie_name}` : "Bạn có thông báo mới";
      const description = latest?.message ?? `${count} thông báo chưa đọc`;
      toast(title, {
        description,
        action: latest
          ? {
              label: "Xem",
              onClick: () => {
                if (latest.episode) {
                  navigate({
                    to: "/xem/$slug/tap-{$episode}",
                    params: { slug: latest.movie_slug, episode: latest.episode },
                    search: { t: 0 },
                  });
                } else {
                  navigate({ to: "/phim/$slug", params: { slug: latest.movie_slug } });
                }
              },
            }
          : undefined,
      });
    }
  }, [count, items, navigate]);

  return bump;
}


export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; all?: boolean }) => {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<{ items: Notification[] }>(["notifications"]);
      qc.setQueryData<{ items: Notification[] }>(["notifications"], (old) => ({
        items: (old?.items ?? []).map((n) =>
          payload.all || n.id === payload.id ? { ...n, read: true } : n,
        ),
      }));
      const prevCount = qc.getQueryData<{ count: number }>([
        "notifications",
        "unread-count",
      ]);
      qc.setQueryData<{ count: number }>(
        ["notifications", "unread-count"],
        (old) => ({
          count: payload.all ? 0 : Math.max(0, (old?.count ?? 1) - 1),
        }),
      );
      return { prev, prevCount };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
      if (ctx?.prevCount)
        qc.setQueryData(["notifications", "unread-count"], ctx.prevCount);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: countData } = useUnreadCount();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const count = countData?.count ?? 0;
  const items = data?.items ?? [];
  const latest = items.slice(0, 5);
  const bump = useNotificationAlerts(count, items);

  const qc = useQueryClient();
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) {
        qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);


  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Thông báo (${count} chưa đọc)` : "Thông báo"}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <motion.span
          key={bump}
          animate={bump > 0 ? { rotate: [0, -15, 12, -8, 6, 0] } : { rotate: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="inline-flex"
        >
          <Bell className="h-5 w-5" />
        </motion.span>
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key={`badge-${bump}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [1, 1.35, 1], opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.4 }}
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-lg shadow-primary/40"
            >
              {count > 9 ? "9+" : count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>


      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass-strong absolute right-0 top-[calc(100%+8px)] z-50 w-[92vw] max-w-sm overflow-hidden rounded-2xl border border-foreground/10 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold text-foreground">
                  Thông báo
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {count} mới
                  </span>
                )}
              </div>
              {count > 0 && (
                <button
                  onClick={() => markRead.mutate({ all: true })}
                  className="text-xs text-muted-foreground transition hover:text-primary"
                >
                  Đọc tất cả
                </button>
              )}
            </div>

            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2.5">
                    <div className="h-14 w-10 flex-shrink-0 animate-pulse rounded-md bg-surface-elevated" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-surface-elevated" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-surface-elevated" />
                    </div>
                  </li>
                ))
              ) : latest.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Chưa có thông báo
                </li>
              ) : (
                latest.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={n.episode ? "/xem/$slug/tap-{$episode}" : "/phim/$slug"}
                      params={
                        n.episode
                          ? { slug: n.movie_slug, episode: n.episode }
                          : { slug: n.movie_slug }
                      }
                      search={n.episode ? { t: 0 } : undefined}
                      onClick={() => {
                        if (!n.read) markRead.mutate({ id: n.id });
                        setOpen(false);
                      }}
                      className="flex gap-3 px-3 py-2.5 transition hover:bg-surface-elevated"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={thumbSrc(n.movie_thumb,{w:200})}
                          alt=""
                          className="h-14 w-10 rounded-md bg-foreground/10 object-cover"
                          loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg"; }}
                        />
                        {!n.read && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-black" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {(() => {
                          const c = formatNotificationCopy(n);
                          return (
                            <>
                              <div className="truncate text-sm font-medium text-foreground">
                                {c.headline}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <PlayCircle className="h-3 w-3 text-accent" />
                                <span className="truncate">{c.meta}</span>
                              </div>
                            </>
                          );
                        })()}
                        {n.type === "new_episode" && !n.read && (
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                            Xem ngay →
                          </div>
                        )}
                      </div>

                    </Link>
                  </li>
                ))
              )}
            </ul>

            <div className="border-t border-foreground/10">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                Xem tất cả
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NotificationRow({
  n,
  onMarkRead,
}: {
  n: Notification;
  onMarkRead: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex items-start gap-4 overflow-hidden rounded-2xl border p-3 transition-all duration-300 ${
        n.read
          ? "glass border-foreground/5"
          : "glass-strong border-primary/40 shadow-lg shadow-primary/15 ring-1 ring-primary/25"
      }`}
    >
      {!n.read && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-primary via-accent to-primary/40"
        />
      )}
      <Link
        to={n.episode ? "/xem/$slug/tap-{$episode}" : "/phim/$slug"}
        params={
          n.episode
            ? { slug: n.movie_slug, episode: n.episode }
            : { slug: n.movie_slug }
        }
        search={n.episode ? { t: 0 } : undefined}
        onClick={() => {
          if (!n.read) onMarkRead();
        }}
        className="group flex flex-1 items-start gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <div className="relative flex-shrink-0">
          <img
            src={thumbSrc(n.movie_thumb, { w: 200 })}
            alt=""
            className="h-24 w-16 rounded-lg bg-foreground/10 object-cover shadow-md transition-transform duration-300 group-hover:scale-[1.03] sm:h-28 sm:w-20"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg";
            }}
          />
          {!n.read && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_theme(colors.primary.DEFAULT)] ring-2 ring-background"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {n.episode && (
              <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                Tập {n.episode}
              </span>
            )}
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatRelative(n.createdAt)}
            </span>
          </div>
          <div className="font-display font-semibold text-foreground transition-colors group-hover:text-primary">
            {n.movie_name}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
        </div>
      </Link>
      {!n.read && (
        <button
          onClick={onMarkRead}
          aria-label="Đánh dấu đã đọc"
          className="flex min-h-11 flex-shrink-0 items-center gap-1 rounded-full border border-foreground/10 bg-surface-elevated/60 px-3 text-xs text-foreground/80 transition hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Check className="h-3.5 w-3.5" /> Đã đọc
        </button>
      )}
    </motion.div>
  );

}
