import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

import {
  Chip,
  ChipRow,
  EmptyState,
  GridSkeleton,
  MovieGrid,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { transition } from "@/lib/design";

type FavoriteItem = {
  movie_slug: string;
  movie_name: string;
  movie_origin_name?: string;
  movie_thumb: string;
  createdAt: number;
};

type SortKey = "recent" | "az" | "za";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Yêu thích — movieCC" },
      { name: "description", content: "Kho phim bạn đã yêu thích và lưu giữ." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <FavoritesPage />
    </RequireAuth>
  ),
});

function FavoritesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [sort, setSort] = useState<SortKey>("recent");

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
  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "recent") arr.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "az") arr.sort((a, b) => a.movie_name.localeCompare(b.movie_name));
    if (sort === "za") arr.sort((a, b) => b.movie_name.localeCompare(a.movie_name));
    return arr;
  }, [items, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("favorites.eyebrow")}
        title={t("favorites.title")}
        subtitle={t("favorites.subtitle")}
        count={query.isLoading ? undefined : items.length}
        countLabel={
          query.isLoading ? undefined : t("favorites.count", { n: items.length })
        }
        icon={<Heart className="h-5 w-5 fill-current" />}
      />

      {items.length > 0 && (
        <ChipRow>
          {(["recent", "az", "za"] as const).map((key) => (
            <Chip key={key} active={sort === key} onClick={() => setSort(key)}>
              {t(`favorites.sort.${key}`)}
            </Chip>
          ))}
        </ChipRow>
      )}

      {query.isLoading ? (
        <GridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title={t("favorites.empty.title")}
          description={t("favorites.empty.description")}
          cta={{ label: t("favorites.empty.cta"), to: "/" }}
        />
      ) : (
        <MovieGrid>
          {sorted.map((item, i) => (
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
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.scene, delay: Math.min(index * 0.03, 0.4) }}
      className="group relative overflow-hidden rounded-2xl border border-foreground/10 bg-elevated transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/15"
    >
      <Link
        to="/phim/$slug"
        params={{ slug: item.movie_slug }}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
          <img
            src={thumbSrc(item.movie_thumb, { w: 400 })}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.04]"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
          <motion.div
            initial={false}
            whileHover={{ scale: 1.08 }}
            transition={transition.micro}
            className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40"
          >
            <Heart className="h-4 w-4 fill-current" />
          </motion.div>
        </div>
        <div className="p-3">
          <div className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {item.movie_name}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {item.movie_origin_name}
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        aria-label={t("favorites.remove")}
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-foreground/80 opacity-0 backdrop-blur-sm transition hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 group-hover:opacity-100 md:h-8 md:w-8"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
