import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, X, StickyNote, Check } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import {
  EmptyState,
  GridSkeleton,
  MovieGrid,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";

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
      { name: "description", content: "Danh sách phim bạn muốn xem sau." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <WatchlistPage />
    </RequireAuth>
  ),
});

function WatchlistPage() {
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
        title="Xem sau"
        count={query.isLoading ? undefined : items.length}
        icon={<Bookmark className="h-5 w-5 fill-white" />}
      />

      {query.isLoading ? (
        <GridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-8 w-8" />}
          title="Danh sách xem sau trống"
          description="Lưu phim vào đây để xem lại vào lúc rảnh."
          cta={{ label: "Duyệt phim", to: "/browse" }}
        />
      ) : (
        <MovieGrid>
          {items.map((item, i) => (
            <WatchlistCard
              key={item.movie_slug}
              item={item}
              index={i}
              onRemove={() => toggle.mutate(item)}
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
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note ?? "");

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
          <div className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent/90 text-black shadow-lg shadow-accent/40">
            <Bookmark className="h-4 w-4 fill-black" />
          </div>
          {item.note && !editing && (
            <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/70 p-2 text-[11px] leading-snug text-white/90 backdrop-blur">
              <StickyNote className="mb-1 inline h-3 w-3 text-accent" />{" "}
              <span className="line-clamp-2">{item.note}</span>
            </div>
          )}
        </div>
        <div className="p-2.5">
          <div className="truncate text-sm font-medium text-white group-hover:text-primary">
            {item.movie_name}
          </div>
          <div className="truncate text-xs text-white/50">{item.movie_origin_name}</div>
        </div>
      </Link>

      <div className="flex items-center gap-1 border-t border-white/5 px-2 py-1.5">
        {editing ? (
          <>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú..."
              maxLength={500}
              autoFocus
              className="h-7 flex-1 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-primary/60"
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                onSaveNote(note.trim());
                setEditing(false);
              }}
              aria-label="Lưu"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              setEditing(true);
            }}
            className="flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <StickyNote className="h-3.5 w-3.5" />
            {item.note ? "Sửa ghi chú" : "Thêm ghi chú"}
          </button>
        )}
      </div>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Xóa khỏi danh sách"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white/80 opacity-0 transition hover:bg-primary hover:text-white group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
