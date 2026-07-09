import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Filter, SlidersHorizontal, Star, X, Play, Compass } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { useTranslation } from "@/hooks/useTranslation";
import { ExperienceCard } from "@/components/home/experience-card";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/design";

const TYPE_LABEL_KEYS: Record<string, string> = {
  "phim-bo": "phim-bo",
  "phim-le": "phim-le",
  "hoat-hinh": "hoat-hinh",
};

const CATEGORIES = [
  "Hành động", "Phiêu lưu", "Chính kịch", "Kinh dị", "Hài", "Tình cảm",
  "Khoa học viễn tưởng", "Bí ẩn", "Tội phạm", "Lịch sử",
];
const COUNTRIES = ["Mỹ", "Anh", "Hàn Quốc", "Nhật Bản", "Trung Quốc", "Việt Nam", "Pháp", "Tây Ban Nha"];
const YEARS = ["2024", "2023", "2022", "2021", "2020", "2019"];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const searchSchema = z.object({
  page: fallback(z.number().int(), 1).default(1),
  sort: fallback(z.string(), "newest").default("newest"),
  year: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  country: fallback(z.string(), "").default(""),
});
type BrowseSearch = z.infer<typeof searchSchema>;

type BrowseMovie = {
  id: number; slug: string; title: string; origin_name: string;
  poster_url: string; year: number; rating: number;
  quality: string; language: string;
};

export const Route = createFileRoute("/browse/$type")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: ({ params }) => {
    if (params.type === "phim-moi-cap-nhat") {
      throw redirect({ to: "/lich-chieu" });
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.type)} — MovieCC` },
      { name: "description", content: "Browse the full catalog. Filter by genre, country, year." },
    ],
  }),
  component: BrowseDiscoveryBoard,
});

function BrowseDiscoveryBoard() {
  const { type } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const query = useQuery<{ items: BrowseMovie[]; totalPages: number; total: number; page: number }>({
    queryKey: ["browse", type, search],
    queryFn: async ({ signal }) => {
      const p = new URLSearchParams({
        type,
        page: String(search.page),
        sort: search.sort,
        year: search.year,
        category: search.category,
        country: search.country,
      });
      return (await fetch(`/api/browse?${p}`, { signal })).json();
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const activeFilters = [search.year, search.category, search.country].filter(Boolean).length;

  const setFilter = (patch: Partial<BrowseSearch>) =>
    navigate({ search: (prev: BrowseSearch) => ({ ...prev, ...patch, page: 1 }) });

  const typeLabelKey = TYPE_LABEL_KEYS[type];
  const heading = typeLabelKey
    ? t(`search.typeLabels.${typeLabelKey}`)
    : decodeURIComponent(type);

  const featured = search.page === 1 ? items.slice(0, 3) : [];
  const rest = search.page === 1 ? items.slice(3) : items;

  return (
    <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8">
      {/* Cinematic header */}
      <section className="relative overflow-hidden border-b border-white/5 px-4 pb-8 pt-10 md:px-6 md:pt-14 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, oklch(0.55 0.22 15 / 0.25), transparent 55%), radial-gradient(ellipse at 80% 60%, oklch(0.5 0.2 280 / 0.2), transparent 60%)",
          }}
        />
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.28em] text-primary/80">
              <Compass className="h-3.5 w-3.5" /> {t("nav.browse")}
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              {heading}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {query.isLoading
                ? t("browse.loading")
                : t("browse.resultsCount", { n: query.data?.total ?? 0 })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <label className="sr-only" htmlFor="browse-sort">
                {t("browse.sortBy")}
              </label>
              <select
                id="browse-sort"
                value={search.sort}
                onChange={(e) => setFilter({ sort: e.target.value })}
                className="h-10 rounded-full border border-white/10 bg-black/40 px-4 text-sm text-foreground outline-none backdrop-blur focus:border-primary/60"
              >
                <option value="newest" className="bg-elevated">{t("browse.sort.newest")}</option>
                <option value="oldest" className="bg-elevated">{t("browse.sort.oldest")}</option>
                <option value="rating" className="bg-elevated">{t("browse.sort.rating")}</option>
                <option value="az" className="bg-elevated">{t("browse.sort.az")}</option>
              </select>
            </div>
            <button
              onClick={() => setMobileOpen(true)}
              className="glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-foreground transition hover:border-white/25 lg:hidden"
              aria-label={t("browse.openFilters")}
            >
              <SlidersHorizontal className="h-4 w-4" /> {t("browse.openFilters")}
              {activeFilters > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <FiltersPanel search={search} onChange={setFilter} />
          </aside>

          <FilterBottomSheet open={mobileOpen} onClose={() => setMobileOpen(false)}>
            <FiltersPanel search={search} onChange={setFilter} />
          </FilterBottomSheet>

          <div className="space-y-8">
            {query.isLoading && !query.data ? (
              <GridSkeleton />
            ) : items.length === 0 ? (
              <EmptyBoard />
            ) : (
              <>
                {featured.length > 0 && <EditorialFeatured items={featured} />}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
                  {rest.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: Math.min(i * 0.025, 0.4),
                        ease: ease.outSoft,
                      }}
                    >
                      <ExperienceCard
                        movie={{
                          id: m.id, slug: m.slug, title: m.title,
                          poster_url: m.poster_url, year: m.year, rating: m.rating,
                        }}
                        meta={{ year: m.year }}
                        size="md"
                        className="w-full"
                      />
                    </motion.div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <Pagination
                    page={search.page}
                    totalPages={totalPages}
                    onChange={(p) =>
                      navigate({ search: (prev: BrowseSearch) => ({ ...prev, page: p }) })
                    }
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function EditorialFeatured({ items }: { items: BrowseMovie[] }) {
  const { t } = useTranslation();
  const [primary, ...side] = items;
  if (!primary) return null;
  return (
    <section>
      <div className="mb-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-primary/80">
          {t("browse.featuredEyebrow")}
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
          {t("browse.featured")}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <FeatureCard movie={primary} large />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
          {side.map((m) => (
            <FeatureCard key={m.id} movie={m} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ movie, large }: { movie: BrowseMovie; large?: boolean }) {
  return (
    <Link
      to="/phim/$slug"
      params={{ slug: movie.slug }}
      className={cn(
        "group relative block overflow-hidden rounded-3xl border border-white/10 bg-black/40",
        large ? "aspect-[16/10] md:aspect-[16/11]" : "aspect-[16/10]",
      )}
    >
      <img
        src={thumbSrc(movie.poster_url, { w: 900 })}
        alt={movie.title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/90">
          <Star className="h-3 w-3 fill-current" /> {movie.rating.toFixed(1)}
          <span className="opacity-60">·</span>
          <span>{movie.year}</span>
          <span className="opacity-60">·</span>
          <span>{movie.quality}</span>
        </div>
        <h3 className={cn(
          "font-display font-semibold leading-tight text-foreground",
          large ? "text-2xl md:text-3xl" : "text-lg",
        )}>
          {movie.title}
        </h3>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-foreground opacity-0 backdrop-blur transition group-hover:opacity-100">
          <Play className="h-3 w-3 fill-current" /> {movie.language}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function FiltersPanel({
  search, onChange,
}: {
  search: BrowseSearch;
  onChange: (patch: Partial<BrowseSearch>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="glass sticky top-20 space-y-5 rounded-2xl border border-white/10 p-4 backdrop-blur-xl">
      <FilterGroup label={t("browse.filters.year")}>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!search.year} onClick={() => onChange({ year: "" })}>
            {t("browse.filters.all")}
          </Chip>
          {YEARS.map((y) => (
            <Chip key={y} active={search.year === y} onClick={() => onChange({ year: y })}>
              {y}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label={t("browse.filters.genre")}>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!search.category} onClick={() => onChange({ category: "" })}>
            {t("browse.filters.all")}
          </Chip>
          {CATEGORIES.map((c) => {
            const slug = slugify(c);
            return (
              <Chip
                key={c}
                active={search.category === slug}
                onClick={() => onChange({ category: search.category === slug ? "" : slug })}
              >
                {c}
              </Chip>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup label={t("browse.filters.country")}>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!search.country} onClick={() => onChange({ country: "" })}>
            {t("browse.filters.all")}
          </Chip>
          {COUNTRIES.map((c) => {
            const slug = slugify(c);
            return (
              <Chip
                key={c}
                active={search.country === slug}
                onClick={() => onChange({ country: search.country === slug ? "" : slug })}
              >
                {c}
              </Chip>
            );
          })}
        </div>
      </FilterGroup>

      {(search.year || search.category || search.country) && (
        <button
          onClick={() => onChange({ year: "", category: "", country: "" })}
          className="w-full rounded-full border border-white/10 py-2 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          {t("browse.filters.clear")}
        </button>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 20 }}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary/20 text-primary"
          : "border-white/10 bg-white/5 text-foreground/80 hover:border-white/25 hover:text-foreground",
      )}
    >
      {children}
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function FilterBottomSheet({
  open, onClose, children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();

  // Lock scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          className="fixed inset-0 z-50 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass-strong absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 p-4"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {t("browse.filters.title")}
              </h3>
              <button
                onClick={onClose}
                className="text-muted-foreground"
                aria-label={t("browse.closeFilters")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("browse.filters.apply")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function EmptyBoard() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <div className="glass grid h-16 w-16 place-items-center rounded-2xl">
        <Filter className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-display text-lg font-semibold text-foreground">
        {t("browse.empty")}
      </p>
      <p className="text-sm text-muted-foreground">{t("browse.emptyHint")}</p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function Pagination({
  page, totalPages, onChange,
}: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  const push = (v: number | "…") => pages.push(v);
  const add = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...add].filter((v) => v >= 1 && v <= totalPages).sort((a, b) => a - b);
  let prev = 0;
  for (const v of sorted) {
    if (prev && v - prev > 1) push("…");
    push(v);
    prev = v;
  }
  return (
    <div className="flex items-center justify-center gap-1.5 pt-2">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-40"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={i} className="px-1 text-muted-foreground">…</span>
        ) : (
          <button
            key={i}
            onClick={() => onChange(p)}
            className={cn(
              "h-9 min-w-9 rounded-full px-3 text-sm transition",
              p === page
                ? "bg-primary text-primary-foreground"
                : "border border-white/10 text-foreground/80 hover:border-primary/50",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
