import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History as HistoryIcon, Trash2, Play, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";

import {
  EmptyState,
  GridSkeleton,
  GroupHeading,
  MovieGrid,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { transition } from "@/lib/design";

import { hasVisibleProgress } from "@/lib/home-queries";

type HistoryEntry = {
  slug: string;
  episode: string;
  position: number;
  duration: number;
  updatedAt: number;
  name?: string;
  origin_name?: string;
  thumb?: string;
  totalEpisodes?: number;
};

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Hành trình của bạn — movieCC" },
      { name: "description", content: "Tiếp tục hành trình xem phim của bạn." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <HistoryPage />
    </RequireAuth>
  ),
});

type BucketKey = "today" | "yesterday" | "thisWeek" | "older";
const BUCKET_ORDER: BucketKey[] = ["today", "yesterday", "thisWeek", "older"];

function bucketOf(ts: number, now = Date.now()): BucketKey {
  const d = new Date(ts);
  const n = new Date(now);
  const startOfToday = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000;
  const t = d.getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfYesterday) return "yesterday";
  if (t >= startOfWeek) return "thisWeek";
  return "older";
}

function HistoryPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useQuery<{ items: HistoryEntry[] }>({
    queryKey: ["history"],
    queryFn: async () => (await fetch("/api/history")).json(),
  });

  const removeOne = useMutation({
    mutationFn: async (slug: string) => {
      await fetch(`/api/history?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    },
    onMutate: async (slug) => {
      await qc.cancelQueries({ queryKey: ["history"] });
      const prev = qc.getQueryData<{ items: HistoryEntry[] }>(["history"]);
      qc.setQueryData<{ items: HistoryEntry[] }>(["history"], (old) => ({
        items: (old?.items ?? []).filter((i) => i.slug !== slug),
      }));
      return { prev };
    },
    onError: (_e, _s, ctx) => ctx?.prev && qc.setQueryData(["history"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      await fetch("/api/history", { method: "DELETE" });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["history"] });
      const prev = qc.getQueryData(["history"]);
      qc.setQueryData(["history"], { items: [] });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["history"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  const items = query.data?.items ?? [];

  const unfinished = useMemo(() => {
    return items
      .filter((it) => {
        const p = it.duration > 0 ? it.position / it.duration : 0;
        return hasVisibleProgress(p);
      })
      .map((it) => ({
        it,
        p: it.duration > 0 ? it.position / it.duration : 0,
      }))
      .sort((a, b) => b.p - a.p)
      .map((x) => x.it);
  }, [items]);

  const buckets = useMemo(() => {
    const map: Record<BucketKey, HistoryEntry[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };
    for (const it of items) map[bucketOf(it.updatedAt)].push(it);
    return map;
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("history.eyebrow")}
        title={t("history.title")}
        subtitle={t("history.subtitle")}
        count={query.isLoading ? undefined : items.length}
        countLabel={
          query.isLoading ? undefined : t("history.count", { n: items.length })
        }
        icon={<HistoryIcon className="h-5 w-5" />}
        actions={
          items.length > 0 && (
            <button
              onClick={() => {
                if (confirm(t("history.confirmClear"))) clearAll.mutate();
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-foreground/10 bg-surface-elevated px-4 text-sm text-foreground/80 transition hover:border-destructive/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Trash2 className="h-4 w-4" /> {t("history.clearAll")}
            </button>
          )
        }
      />

      {query.isLoading ? (
        <GridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="h-8 w-8" />}
          title={t("history.empty.title")}
          description={t("history.empty.description")}
          cta={{ label: t("history.empty.cta"), to: "/" }}
        />
      ) : (
        <div className="space-y-10">
          {unfinished.length > 0 && (
            <section aria-label={t("history.groups.unfinished")}>
              <GroupHeading
                label={t("history.groups.unfinished")}
                count={unfinished.length}
              />
              <MovieGrid>
                {unfinished.map((item, i) => (
                  <HistoryCard
                    key={`unfinished-${item.slug}-${item.episode}`}
                    item={item}
                    index={i}
                    onRemove={() => removeOne.mutate(item.slug)}
                  />
                ))}
              </MovieGrid>
            </section>
          )}
          {BUCKET_ORDER.map((key) => {
            const group = buckets[key];
            if (!group.length) return null;
            return (
              <section key={key} aria-label={t(`history.groups.${key}`)}>
                <GroupHeading
                  label={t(`history.groups.${key}`)}
                  count={group.length}
                />
                <MovieGrid>
                  {group.map((item, i) => (
                    <HistoryCard
                      key={`${item.slug}-${item.episode}`}
                      item={item}
                      index={i}
                      onRemove={() => removeOne.mutate(item.slug)}
                    />
                  ))}
                </MovieGrid>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  item,
  index,
  onRemove,
}: {
  item: HistoryEntry;
  index: number;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const progress = item.duration > 0 ? Math.min(1, item.position / item.duration) : 0;
  const percent = Math.round(progress * 100);
  const remainingMin = Math.max(0, Math.round((item.duration - item.position) / 60));
  const title = item.name ?? item.slug;
  const isSeries = (item.totalEpisodes ?? 0) > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.scene, delay: Math.min(index * 0.03, 0.4) }}
      className="group relative overflow-hidden rounded-2xl border border-foreground/10 bg-elevated transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/15"
    >
      <Link
        to="/xem/$slug/tap-{$episode}"
        params={{ slug: item.slug, episode: item.episode }}
        search={{ t: Math.floor(item.position) }}
        aria-label={`${t("history.continue")} ${title}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
          {item.thumb && (
            <img
              src={item.thumb}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.04]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="glass-strong flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-primary/40 shadow-2xl shadow-primary/40">
              <Play className="ml-0.5 h-6 w-6 fill-primary text-primary" />
            </div>
          </div>

          {isSeries && (
            <div className="glass absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-medium text-foreground">
              {t("history.episodeLabel", { ep: item.episode })}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-2.5 mb-2 flex items-center justify-between text-[10px] font-medium tabular-nums text-foreground/85">
              <span>{t("history.progress", { n: percent })}</span>
              <span>{t("history.remaining", { n: remainingMin })}</span>
            </div>
            <div className="h-1 w-full bg-foreground/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={transition.scene}
                className="h-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        aria-label={t("history.remove")}
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-foreground/80 opacity-0 backdrop-blur-sm transition hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 group-hover:opacity-100 md:h-8 md:w-8"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="p-3">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.origin_name ?? ""}
        </div>
      </div>
    </motion.div>
  );
}
