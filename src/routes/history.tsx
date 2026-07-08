import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History as HistoryIcon, Trash2, Play, X } from "lucide-react";
import { motion } from "motion/react";

import {
  EmptyState,
  GridSkeleton,
  MovieGrid,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";

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
      { title: "Lịch sử xem — movieCC" },
      { name: "description", content: "Xem tiếp những gì bạn đang dở." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <HistoryPage />
    </RequireAuth>
  ),
});

function HistoryPage() {
  const qc = useQueryClient();
  const query = useQuery<{ items: HistoryEntry[] }>({
    queryKey: ["history"],
    queryFn: async () => {
      const res = await fetch("/api/history");
      return await res.json();
    },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đang xem"
        count={query.isLoading ? undefined : items.length}
        icon={<HistoryIcon className="h-5 w-5" />}
        actions={
          items.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Xóa toàn bộ lịch sử xem?")) clearAll.mutate();
              }}
              className="flex items-center gap-1.5 rounded-full border border-foreground/10 bg-surface-elevated px-4 py-2 text-sm text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" /> Xóa tất cả
            </button>
          )
        }
      />

      {query.isLoading ? (
        <GridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="h-8 w-8" />}
          title="Chưa xem phim nào"
          description="Các phim bạn đang xem sẽ hiện tại đây để tiếp tục nhanh chóng."
          cta={{ label: "Khám phá ngay", to: "/" }}
        />
      ) : (
        <MovieGrid>
          {items.map((item, i) => (
            <HistoryCard
              key={`${item.slug}-${item.episode}`}
              item={item}
              index={i}
              onRemove={() => removeOne.mutate(item.slug)}
            />
          ))}
        </MovieGrid>
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
  const progress = item.duration > 0 ? Math.min(1, item.position / item.duration) : 0;
  const remainingMin = Math.max(0, Math.round((item.duration - item.position) / 60));
  const title = item.name ?? item.slug;
  const isSeries = (item.totalEpisodes ?? 0) > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4) }}
      className="group relative overflow-hidden rounded-xl border border-foreground/10 bg-elevated"
    >
      <Link
        to="/xem/$slug/tap-{$episode}"
        params={{ slug: item.slug, episode: item.episode }}
        search={{ t: Math.floor(item.position) }}
        className="block"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
          {item.thumb && (
            <img
              src={item.thumb}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-2xl shadow-primary/50">
              <Play className="ml-0.5 h-6 w-6 fill-white text-foreground" />
            </div>
          </div>

          {isSeries && (
            <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              Tập {item.episode}
            </div>
          )}

          {/* Progress bar */}
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-2 mb-2 flex items-center justify-between text-[10px] text-foreground/70">
              <span>{Math.round(progress * 100)}%</span>
              <span>{remainingMin} phút còn lại</span>
            </div>
            <div className="h-1 w-full bg-foreground/10">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent"
                style={{ width: `${progress * 100}%` }}
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
        aria-label="Xóa khỏi lịch sử"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white/80 opacity-0 transition hover:bg-primary hover:text-white group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="p-2.5">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{item.origin_name ?? ""}</div>
      </div>
    </motion.div>
  );
}
