import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Film, Star } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  page: fallback(z.number().int(), 1).default(1),
});

type Movie = {
  id: number; slug: string; title: string; origin_name: string;
  poster_url: string; year: number; rating: number;
};
type ActorData = {
  actor: { slug: string; name: string; avatar_url: string; known_for: string[]; movie_count: number } | null;
  items: Movie[];
  page: number;
  totalPages: number;
  total: number;
};

export const Route = createFileRoute("/dien-vien/$name")({
  validateSearch: zodValidator(searchSchema),
  head: ({ params }) => {
    const name = decodeURIComponent(params.name).replace(/-/g, " ");
    return {
      meta: [
        { title: `Phim của ${name} — movieCC` },
        { name: "description", content: `Toàn bộ tác phẩm của ${name}.` },
      ],
    };
  },
  component: ActorMoviesPage,
});

function ActorMoviesPage() {
  const { name } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const query = useQuery<ActorData>({
    queryKey: ["actor", name, page],
    queryFn: async () => (await fetch(`/api/actors/${encodeURIComponent(name)}?page=${page}`)).json(),
    placeholderData: (prev) => prev,
  });

  const actor = query.data?.actor;
  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  return (
    <div className="space-y-8">
      <Link
        to="/dien-vien"
        className="inline-flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Tìm diễn viên khác
      </Link>

      {/* Actor header */}
      {query.isLoading && !actor ? (
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-end">
          <div className="h-36 w-36 animate-pulse rounded-full bg-white/10" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-1/3 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ) : !actor ? (
        <div className="py-24 text-center">
          <p className="text-white/60">Không tìm thấy diễn viên này.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass flex flex-col items-center gap-6 rounded-3xl border border-white/10 p-6 text-center md:flex-row md:items-end md:text-left"
        >
          <img
            src={actor.avatar_url}
            alt={actor.name}
            className="h-36 w-36 rounded-full bg-white/10 object-cover ring-4 ring-primary/30 shadow-2xl shadow-primary/20"
          />
          <div className="flex-1 space-y-2">
            <div className="text-xs uppercase tracking-widest text-primary">Diễn viên</div>
            <h1 className="font-display text-3xl font-bold text-white md:text-4xl">
              {actor.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/60 md:justify-start">
              <span className="inline-flex items-center gap-1">
                <Film className="h-4 w-4 text-accent" /> {actor.movie_count} tác phẩm
              </span>
              <span>Nổi bật với: {actor.known_for.join(", ")}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Films grid */}
      {actor && (
        <div className="space-y-5">
          <h2 className="font-display text-xl font-semibold text-white">Danh sách phim</h2>
          {query.isLoading && !items.length ? (
            <GridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-6">
              {items.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Link
                    to="/phim/$slug"
                    params={{ slug: m.slug }}
                    className="group block overflow-hidden rounded-xl border border-white/5 bg-elevated transition hover:border-primary/40"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
                      <img
                        src={m.poster_url}
                        alt={m.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-accent backdrop-blur">
                        <Star className="h-3 w-3 fill-accent" />
                        {m.rating.toFixed(1)}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="truncate text-sm font-medium text-white group-hover:text-primary">
                        {m.title}
                      </div>
                      <div className="text-xs text-white/50">{m.year}</div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => navigate({ search: { page: p } })}
                    className={`h-9 min-w-9 rounded-full px-3 text-sm transition ${
                      p === page
                        ? "bg-primary text-white"
                        : "border border-white/10 text-white/70 hover:border-primary/50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-white/5" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
