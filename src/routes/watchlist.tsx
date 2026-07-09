import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, X, StickyNote, Check } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import {
  EmptyState,
  GridSkeleton,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { transition } from "@/lib/design";

type WatchlistItem = {
  movie_slug: string;
  movie_name: string;
  movie_origin_name?: string;
  movie_thumb: string;
  note?: string;
  createdAt: number;
};

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

  const toggle = useMutation({
    mutationFn: async (item: WatchlistItem) => {
      const res = await fetch("/api/watchlist/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("toggle failed");
      return res.json();
    },
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("watchlist.eyebrow")}
        title={t("watchlist.title")}
        subtitle={t("watchlist.subtitle")}
        count={query.isLoading ? undefined : items.length}
        countLabel={
          query.isLoading ? undefined : t("watchlist.count", { n: items.length })
        }
        icon={<Bookmark className="h-5 w-5 fill-current" />}
      />

      {query.isLoading ? (
        <GridSkeleton count={6} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-8 w-8" />}
          title={t("watchlist.empty.title")}
          description={t("watchlist.empty.description")}
          cta={{ label: t("watchlist.empty.cta"), to: "/browse" }}
        />
      ) : (
        <ol className="relative space-y-3 pl-6 sm:pl-10">
          <span
            aria-hidden
            className="pointer-events-none absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-foreground/10 to-transparent sm:left-4"
          />
          {items.map((item, i) => (
            <WatchlistRow
              key={item.movie_slug}
              item={item}
              index={i}
              onRemove={() => toggle.mutate(item)}
              onSaveNote={(note) => saveNote.mutate({ slug: item.movie_slug, note })}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function WatchlistRow({
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

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...transition.scene, delay: Math.min(index * 0.04, 0.4) }}
      className="group relative"
    >
      <span
        aria-hidden
        className="absolute -left-6 top-6 flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-background text-[10px] font-semibold tabular-nums text-primary sm:-left-10 sm:h-8 sm:w-8 sm:text-xs"
      >
        {index + 1}
      </span>

      <div className="glass flex gap-3 overflow-hidden rounded-2xl border border-foreground/10 p-2.5 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/15 sm:gap-4 sm:p-3">
        <Link
          to="/phim/$slug"
          params={{ slug: item.movie_slug }}
          className="relative block h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:h-28 sm:w-20"
          aria-label={item.movie_name}
        >
          <img
            src={thumbSrc(item.movie_thumb, { w: 200 })}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.04]"
          />
          <div className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent/90 text-black shadow-sm shadow-accent/40">
            <Bookmark className="h-3 w-3 fill-black" />
          </div>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
          <div className="min-w-0">
            <Link
              to="/phim/$slug"
              params={{ slug: item.movie_slug }}
              className="block truncate font-display text-sm font-semibold text-foreground transition-colors hover:text-primary sm:text-base"
            >
              {item.movie_name}
            </Link>
            {item.movie_origin_name && (
              <div className="truncate text-xs text-muted-foreground">
                {item.movie_origin_name}
              </div>
            )}
            {item.note && !editing && (
              <p className="mt-1.5 line-clamp-2 rounded-md bg-surface-elevated/60 px-2 py-1 text-[11px] leading-snug text-foreground/80">
                <StickyNote className="mr-1 inline h-3 w-3 text-accent" />
                {item.note}
              </p>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            {editing ? (
              <>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("watchlist.addNote")}
                  maxLength={500}
                  autoFocus
                  aria-label={t("watchlist.editNote")}
                  className="h-8 flex-1 rounded-md border border-foreground/10 bg-black/30 px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
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
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 md:min-h-0 md:py-1.5"
              >
                <StickyNote className="h-3.5 w-3.5" />
                {item.note ? t("watchlist.editNote") : t("watchlist.addNote")}
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onRemove}
          aria-label={t("watchlist.remove")}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center self-start rounded-full text-muted-foreground opacity-0 transition hover:bg-surface-elevated hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 group-hover:opacity-100 md:h-9 md:w-9"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.li>
  );
}
