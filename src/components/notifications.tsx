import { thumbSrc } from "@/utils/thumbSrc";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, PlayCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";


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

export function useNotifications() {
  return useQuery<{ items: Notification[] }>({
    queryKey: ["notifications"],
    queryFn: async () => (await fetch("/api/notifications")).json(),
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await fetch("/api/notifications/unread-count")).json(),
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 60_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground"
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
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white shadow-lg shadow-primary/40"
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
            className="glass-strong absolute right-0 top-[calc(100%+8px)] z-50 w-[92vw] max-w-sm overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold text-white">
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
                  className="text-xs text-white/60 transition hover:text-primary"
                >
                  Đọc tất cả
                </button>
              )}
            </div>

            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2.5">
                    <div className="h-14 w-10 flex-shrink-0 animate-pulse rounded-md bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
                    </div>
                  </li>
                ))
              ) : latest.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-white/50">
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
                      className="flex gap-3 px-3 py-2.5 transition hover:bg-white/5"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={thumbSrc(n.movie_thumb,{w:200})}
                          alt=""
                          className="h-14 w-10 rounded-md object-cover"
                          loading="lazy"
                        />
                        {!n.read && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-black" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {n.movie_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <PlayCircle className="h-3 w-3 text-accent" />
                          <span className="truncate">{n.message}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/40">
                          {formatRelative(n.createdAt)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>

            <div className="border-t border-white/5">
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
      className={`glass flex items-start gap-4 rounded-2xl border p-3 transition ${
        n.read ? "border-white/5" : "border-primary/30 bg-primary/5"
      }`}
    >
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
        className="group flex flex-1 items-start gap-4"
      >
        <div className="relative flex-shrink-0">
          <img
            src={thumbSrc(n.movie_thumb,{w:200})}
            alt=""
            className="h-24 w-16 rounded-lg object-cover shadow-md sm:h-28 sm:w-20"
            loading="lazy"
          />
          {!n.read && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary ring-2 ring-bg" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {n.episode && (
              <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                Tập mới
              </span>
            )}
            <span className="text-xs text-white/40">{formatRelative(n.createdAt)}</span>
          </div>
          <div className="font-medium text-white group-hover:text-primary">
            {n.movie_name}
          </div>
          <p className="mt-0.5 text-sm text-white/60">{n.message}</p>
        </div>
      </Link>
      {!n.read && (
        <button
          onClick={onMarkRead}
          className="flex flex-shrink-0 items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-primary/50 hover:text-white"
        >
          <Check className="h-3.5 w-3.5" /> Đã đọc
        </button>
      )}
    </motion.div>
  );
}
