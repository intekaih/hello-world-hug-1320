import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { motion } from "motion/react";

import {
  EmptyState,
  GridSkeleton,
  MovieGrid,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";

type FavoriteItem = {
  movie_slug: string;
  movie_name: string;
  movie_origin_name?: string;
  movie_thumb: string;
  createdAt: number;
};

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Yêu thích — movieCC" },
      { name: "description", content: "Những bộ phim bạn đã yêu thích." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <FavoritesPage />
    </RequireAuth>
  ),
});

function FavoritesPage() {
  const qc = useQueryClient();
  const query = useQuery<{ items: FavoriteItem[] }>({
    queryKey: ["favorites"],
    queryFn: async () => (await fetch("/api/favorites")).json(),
  });

  const toggle = useMutation({
    mutationFn: async (item: FavoriteItem) => {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("toggle failed");
      return res.json();
    },
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const prev = qc.getQueryData<{ items: FavoriteItem[] }>(["favorites"]);
      qc.setQueryData<{ items: FavoriteItem[] }>(["favorites"], (old) => ({
        items: (old?.items ?? []).filter((i) => i.movie_slug !== item.movie_slug),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["favorites"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yêu thích"
        count={query.isLoading ? undefined : items.length}
        icon={<Heart className="h-5 w-5 fill-white" />}
      />

      {query.isLoading ? (
        <GridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title="Chưa có phim yêu thích"
          description="Nhấn vào biểu tượng trái tim ở trang phim để lưu vào đây."
          cta={{ label: "Khám phá phim", to: "/" }}
        />
      ) : (
        <MovieGrid>
          {items.map((item, i) => (
            <FavoriteCard
              key={item.movie_slug}
              item={item}
              index={i}
              onToggle={() => toggle.mutate(item)}
            />
          ))}
        </MovieGrid>
      )}
    </div>
  );
}

function FavoriteCard({
  item,
  index,
  onToggle,
}: {
  item: FavoriteItem;
  index: number;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4) }}
      className="group relative overflow-hidden rounded-xl border border-white/5 bg-elevated"
    >
      <Link
        to="/phim/$slug"
        params={{ slug: item.movie_slug }}
        className="block"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
          <img
            src={thumbSrc(item.movie_thumb,{w:400})}
            alt={item.movie_name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg shadow-primary/40">
            <Heart className="h-4 w-4 fill-white" />
          </div>
        </div>
        <div className="p-2.5">
          <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {item.movie_name}
          </div>
          <div className="truncate text-xs text-muted-foreground">{item.movie_origin_name}</div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        aria-label="Bỏ yêu thích"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white/80 opacity-0 transition hover:bg-primary hover:text-white group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
