import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Filter, SlidersHorizontal, Star, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

const TYPE_LABELS: Record<string, string> = {
  "phim-bo": "Phim bộ",
  "phim-le": "Phim lẻ",
  "hoat-hinh": "Anime · Hoạt hình",
  "phim-moi-cap-nhat": "Phim mới cập nhật",
};

const CATEGORIES = [
  "Hành động", "Phiêu lưu", "Chính kịch", "Kinh dị", "Hài", "Tình cảm",
  "Khoa học viễn tưởng", "Bí ẩn", "Tội phạm", "Lịch sử",
];
const COUNTRIES = ["Mỹ", "Anh", "Hàn Quốc", "Nhật Bản", "Trung Quốc", "Việt Nam", "Pháp", "Tây Ban Nha"];
const YEARS = ["2024", "2023", "2022", "2021", "2020", "2019"];
const SORTS = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "rating", label: "Điểm cao" },
  { value: "az", label: "A → Z" },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const searchSchema = z.object({
  page: fallback(z.number().int(), 1).default(1),
  sort: fallback(z.string(), "newest").default("newest"),
  year: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  country: fallback(z.string(), "").default(""),
});

type BrowseMovie = {
  id: number; slug: string; title: string; origin_name: string;
  poster_url: string; year: number; rating: number;
  quality: string; language: string;
};

export const Route = createFileRoute("/browse/$type")({
  validateSearch: zodValidator(searchSchema),
  head: ({ params }) => ({
    meta: [
      { title: `${TYPE_LABELS[params.type] ?? decodeURIComponent(params.type)} — movieCC` },
      { name: "description", content: "Duyệt kho phim đầy đủ, lọc theo thể loại, quốc gia, năm." },
    ],
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const { type } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const query = useQuery<{ items: BrowseMovie[]; totalPages: number; total: number; page: number }>({
    queryKey: ["browse", type, search],
    queryFn: async () => {
      const p = new URLSearchParams({
        type,
        page: String(search.page),
        sort: search.sort,
        year: search.year,
        category: search.category,
        country: search.country,
      });
      return (await fetch(`/api/browse?${p}`)).json();
    },
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const activeFilters = [search.year, search.category, search.country].filter(Boolean).length;

  const setFilter = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white md:text-3xl">
            {TYPE_LABELS[type] ?? decodeURIComponent(type)}
          </h1>
          <p className="text-sm text-white/50">
            {query.isLoading ? "Đang tải..." : `${query.data?.total ?? 0} phim`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={search.sort}
            onChange={(e) => setFilter({ sort: e.target.value })}
            className="h-10 rounded-full border border-white/10 bg-black/40 px-4 text-sm text-white outline-none focus:border-primary/60"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-elevated">
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" /> Lọc
            {activeFilters > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <FiltersPanel search={search} onChange={setFilter} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 flex lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-strong relative ml-auto flex h-full w-72 flex-col overflow-y-auto border-l border-white/10 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-white">Bộ lọc</h3>
                <button onClick={() => setMobileOpen(false)} className="text-white/60">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <FiltersPanel search={search} onChange={setFilter} />
            </div>
          </div>
        )}

        <div className="space-y-5">
          {query.isLoading && !query.data ? (
            <GridSkeleton />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <Filter className="h-8 w-8 text-white/40" />
              <p className="text-white/60">Không có phim khớp bộ lọc</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((m, i) => (
                  <MovieCard key={m.id} item={m} index={i} />
                ))}
              </div>
              {totalPages > 1 && (
                <Pagination
                  page={search.page}
                  totalPages={totalPages}
                  onChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FiltersPanel({
  search,
  onChange,
}: {
  search: z.infer<typeof searchSchema>;
  onChange: (patch: Partial<z.infer<typeof searchSchema>>) => void;
}) {
  return (
    <div className="glass sticky top-20 space-y-5 rounded-2xl border border-white/10 p-4">
      <FilterGroup label="Năm">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!search.year} onClick={() => onChange({ year: "" })}>
            Tất cả
          </Chip>
          {YEARS.map((y) => (
            <Chip key={y} active={search.year === y} onClick={() => onChange({ year: y })}>
              {y}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Thể loại">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!search.category} onClick={() => onChange({ category: "" })}>
            Tất cả
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

      <FilterGroup label="Quốc gia">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!search.country} onClick={() => onChange({ country: "" })}>
            Tất cả
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
          className="w-full rounded-full border border-white/10 py-2 text-sm text-white/70 transition hover:border-primary/50 hover:text-white"
        >
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
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
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-primary bg-primary/20 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function MovieCard({ item, index }: { item: BrowseMovie; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.4) }}
    >
      <Link
        to="/phim/$slug"
        params={{ slug: item.slug }}
        className="group block overflow-hidden rounded-xl border border-white/5 bg-elevated transition hover:border-primary/40"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
          <img
            src={item.poster_url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
            {item.quality}
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-accent backdrop-blur">
            <Star className="h-3 w-3 fill-accent" />
            {item.rating.toFixed(1)}
          </div>
          <div className="absolute bottom-2 left-2 rounded-md bg-primary/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            {item.language}
          </div>
        </div>
        <div className="p-2.5">
          <div className="truncate text-sm font-medium text-white group-hover:text-primary">
            {item.title}
          </div>
          <div className="truncate text-xs text-white/50">
            {item.origin_name} · {item.year}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
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
        className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/80 transition hover:border-primary/50 disabled:opacity-40"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={i} className="px-1 text-white/40">…</span>
        ) : (
          <button
            key={i}
            onClick={() => onChange(p)}
            className={`h-9 min-w-9 rounded-full px-3 text-sm transition ${
              p === page
                ? "bg-primary text-white"
                : "border border-white/10 text-white/80 hover:border-primary/50"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/80 transition hover:border-primary/50 disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
