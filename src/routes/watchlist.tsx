import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, X, StickyNote, Check, Clock } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  GridSkeleton,
  MovieGrid,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { transition } from "@/lib/design";
import { cn } from "@/lib/utils";

type WatchlistItem = {
  movie_slug: string;
  movie_name: string;
  movie_origin_name?: string;
  movie_thumb: string;
  note?: string;
  runtime?: number;
  createdAt: number;
};

const DEFAULT_RUNTIME_MIN = 105; // fallback estimate per unknown title
const STALE_DAYS = 14;

function estimateTotal(items: WatchlistItem[]) {
  return items.reduce(
    (sum, i) => sum + (typeof i.runtime === "number" ? i.runtime : DEFAULT_RUNTIME_MIN),
    0,
  );
}

function daysSince(ts: number) {
  return Math.floor((Date.now() - ts) / 86400000);
}

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Xem sau — movieCC" },
      { name: "description", content: "Hàng chờ xem sau của riêng bạn." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <WatchlistPage />
    </RequireAuth>
  ),
});

function WatchlistPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useQuery<{ items: WatchlistItem[] }>({
    queryKey: ["watchlist"],
    queryFn: async () => (await fetch("/api/watchlist")).json(),
  });

  async function postToggle(item: WatchlistItem) {
    const res = await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error("toggle failed");
    return res.json();
  }

  const removeMutation = useMutation({
    mutationFn: postToggle,
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: ["watchlist"] });
      const prev = qc.getQueryData<{ items: WatchlistItem[] }>(["watchlist"]);
      qc.setQueryData<{ items: WatchlistItem[] }>(["watchlist"], (old) => ({
        items: (old?.items ?? []).filter((i) => i.movie_slug !== item.movie_slug),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["watchlist"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const undoAdd = useMutation({
    mutationFn: postToggle,
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: ["watchlist"] });
      const prev = qc.getQueryData<{ items: WatchlistItem[] }>(["watchlist"]);
      qc.setQueryData<{ items: WatchlistItem[] }>(["watchlist"], (old) => {
        const items = old?.items ?? [];
        if (items.some((i) => i.movie_slug === item.movie_slug)) return { items };
        return { items: [item, ...items] };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["watchlist"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  function handleRemove(item: WatchlistItem) {
    removeMutation.mutate(item);
    toast(t("watchlist.removedToast"), {
      duration: 5000,
      action: {
        label: t("watchlist.undo"),
        onClick: () => undoAdd.mutate(item),
      },
    });
  }

  const saveNote = useMutation({
    mutationFn: async ({ slug, note }: { slug: string; note: string }) => {
      const res = await fetch("/api/watchlist/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ movie_slug: slug, note }),
      });
      if (!res.ok) throw new Error("note failed");
      return res.json();
    },
    onMutate: async ({ slug, note }) => {
      await qc.cancelQueries({ queryKey: ["watchlist"] });
      const prev = qc.getQueryData<{ items: WatchlistItem[] }>(["watchlist"]);
      qc.setQueryData<{ items: WatchlistItem[] }>(["watchlist"], (old) => ({
        items: (old?.items ?? []).map((i) =>
          i.movie_slug === slug ? { ...i, note } : i,
        ),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["watchlist"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const items = query.data?.items ?? [];
  const totalMin = estimateTotal(items);
  const totalHours = totalMin / 60;
  const statsLabel =
    totalMin >= 60
      ? t("watchlist.stats", {
          n: items.length,
          h: totalHours >= 10 ? Math.round(totalHours) : totalHours.toFixed(1),
        })
      : t("watchlist.statsMinutes", { n: items.length, m: totalMin });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("watchlist.eyebrow")}
        title={t("watchlist.title")}
        subtitle={t("watchlist.subtitle")}
        count={query.isLoading ? undefined : items.length}
        countLabel={query.isLoading || items.length === 0 ? undefined : statsLabel}
        icon={<Bookmark className="h-5 w-5 fill-current" />}
      />

      {query.isLoading ? (
        <GridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-8 w-8" />}
          title={t("watchlist.empty.title")}
          description={t("watchlist.empty.description")}
          cta={{ label: t("watchlist.empty.cta"), to: "/kham-pha" }}
        />
      ) : (
        <MovieGrid>
          {items.map((item, i) => (
            <WatchlistCard
              key={item.movie_slug}
              item={item}
              index={i}
              onRemove={() => handleRemove(item)}
              onSaveNote={(note) => saveNote.mutate({ slug: item.movie_slug, note })}
            />
          ))}
        </MovieGrid>
      )}
    </div>
  );
}

function WatchlistCard({
  item,
  index,
  onRemove,
  onSaveNote,
}: {
  item: WatchlistItem;
  index: number;
  onRemove: () => void;
  onSaveNote: (note: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  const days = daysSince(item.createdAt);
  const stale = days >= STALE_DAYS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.scene, delay: Math.min(index * 0.03, 0.35) }}
      className="group relative flex flex-col gap-2"
    >
      <div className="relative overflow-hidden rounded-xl bg-black/40 shadow-sm ring-1 ring-foreground/10 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/15">
        <Link
          to="/phim/$slug"
          params={{ slug: item.movie_slug }}
          className="block aspect-[2/3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label={item.movie_name}
        >
          <img
            src={thumbSrc(item.movie_thumb, { w: 400 })}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {typeof item.runtime === "number" && (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              <Clock className="h-3 w-3" aria-hidden />
              {item.runtime}′
            </span>
          )}
        </Link>

        <button
          onClick={onRemove}
          aria-label={t("watchlist.remove")}
          className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/90 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-w-0 space-y-1">
        <Link
          to="/phim/$slug"
          params={{ slug: item.movie_slug }}
          className="block truncate font-display text-sm font-semibold text-foreground transition-colors hover:text-primary"
        >
          {item.movie_name}
        </Link>

        {stale && (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-500 dark:text-amber-300",
            )}
            title={t("watchlist.stalePrompt", { days })}
          >
            <Clock className="h-3 w-3" aria-hidden />
            {t("watchlist.stalePrompt", { days })}
          </div>
        )}

        {item.note && !editing && (
          <p className="line-clamp-2 rounded-md bg-surface-elevated/60 px-2 py-1 text-[11px] leading-snug text-foreground/80">
            <StickyNote className="mr-1 inline h-3 w-3 text-accent" />
            {item.note}
          </p>
        )}

        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("watchlist.addNote")}
              maxLength={500}
              autoFocus
              aria-label={t("watchlist.editNote")}
              className="h-8 flex-1 rounded-md border border-foreground/10 bg-background/60 px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                onSaveNote(note.trim());
                setEditing(false);
              }}
              aria-label={t("common.close")}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <StickyNote className="h-3 w-3" />
            {item.note ? t("watchlist.editNote") : t("watchlist.addNote")}
          </button>
        )}
      </div>
    </motion.div>
  );
}
