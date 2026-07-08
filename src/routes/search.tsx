import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search as SearchIcon, X, Loader2, Clock, TrendingUp, Star } from "lucide-react";
import { z } from "zod";

import { buildPageMeta } from "@/lib/page-meta";
import { usePageMeta } from "@/hooks/usePageMeta";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
});

type SuggestItem = {
  id: number;
  title: string;
  year: number;
  type: string;
  poster_url: string;
  slug: string;
};

type SearchResult = {
  items: (SuggestItem & { rating: number })[];
  page: number;
  totalPages: number;
  total: number;
};

const RECENT_KEY = "moviecc:recent-searches";
const TRENDING = ["Dune", "Shogun", "Fallout", "Deadpool", "Wednesday", "Demon Slayer"];

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  if (typeof window === "undefined" || !q.trim()) return;
  const prev = loadRecent().filter((s) => s.toLowerCase() !== q.toLowerCase());
  const next = [q, ...prev].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: buildPageMeta({
      title: "Tìm kiếm - movieCC",
      description:
        "Tìm phim, series, anime bạn muốn xem trên movieCC. Kho phim HD Vietsub miễn phí.",
      url: "/search",
    }),
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, page } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState(q);
  const [debounced, setDebounced] = useState(q);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [accumulated, setAccumulated] = useState<SearchResult["items"]>([]);
  const lastQueryRef = useRef<string>("");

  usePageMeta(
    q.trim()
      ? {
          title: `Tìm kiếm: ${q} - movieCC`,
          description: `Kết quả tìm kiếm cho "${q}" trên movieCC. Xem phim HD Vietsub, thuyết minh miễn phí.`,
          url: `/search?q=${encodeURIComponent(q)}`,
          noindex: true,
        }
      : null,
  );

  useEffect(() => {
    setRecent(loadRecent());
    inputRef.current?.focus();
  }, []);

  useEffect(() => setInput(q), [q]);

  // Debounce input → debounced (300ms) for live suggestions
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Suggestions (live, debounced, AbortController)
  const suggestQuery = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(debounced)}`, { signal });
      if (!res.ok) throw new Error("suggest failed");
      return (await res.json()) as { items: SuggestItem[] };
    },
    enabled: debounced.trim().length > 0,
    staleTime: 30_000,
  });

  // Full search results (paginated)
  const resultsQuery = useQuery<SearchResult>({
    queryKey: ["search", q, page],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&page=${page}`,
        { signal },
      );
      if (!res.ok) throw new Error("search failed");
      return await res.json();
    },
    enabled: q.trim().length > 0,
    placeholderData: (prev) => prev,
  });

  // Accumulate items for "load more"
  useEffect(() => {
    if (!resultsQuery.data) return;
    const key = `${q}`;
    if (lastQueryRef.current !== key) {
      lastQueryRef.current = key;
      setAccumulated(resultsQuery.data.items);
    } else if (page === 1) {
      setAccumulated(resultsQuery.data.items);
    } else {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const it of resultsQuery.data!.items) if (!seen.has(it.id)) merged.push(it);
        return merged;
      });
    }
  }, [resultsQuery.data, q, page]);

  function submit(nextQ: string) {
    const trimmed = nextQ.trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    setRecent(loadRecent());
    setFocused(false);
    inputRef.current?.blur();
    navigate({ search: { q: trimmed, page: 1 } });
  }

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  }

  const showSuggestions =
    focused && debounced.trim().length > 0 && (suggestQuery.data?.items?.length ?? 0) > 0;

  const hasResults = q.trim().length > 0;
  const totalPages = resultsQuery.data?.totalPages ?? 0;
  const canLoadMore = hasResults && page < totalPages && !resultsQuery.isFetching;

  return (
    <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8">
      <h1 className="sr-only">
        {q ? `Tìm kiếm phim: ${q}` : "Tìm kiếm phim"}
      </h1>
      {/* Sticky search bar */}
      <div className="glass sticky top-0 z-30 border-b border-foreground/10 px-4 py-3 md:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(input);
                if (e.key === "Escape") {
                  setInput("");
                  setFocused(false);
                }
              }}
              placeholder="Tìm phim, series, anime..."
              className="h-12 w-full rounded-full border border-white/10 bg-black/40 pl-12 pr-12 text-base text-white placeholder:text-white/40 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
              autoComplete="off"
              aria-label="Tìm kiếm"
            />
            {input && (
              <button
                onClick={() => {
                  setInput("");
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
                aria-label="Xóa"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Suggestion dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="glass-strong absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-foreground/10 shadow-2xl"
                >
                  <ul className="max-h-[70vh] overflow-y-auto py-2">
                    {suggestQuery.data!.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => submit(item.title)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-surface-elevated"
                        >
                          <img
                            src={thumbSrc(item.poster_url,{w:400})}
                            alt=""
                            className="h-14 w-10 flex-shrink-0 rounded-md object-cover"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-foreground">{item.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.type} · {item.year}
                            </div>
                          </div>
                          <SearchIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8">
        {!hasResults ? (
          <EmptyState recent={recent} onPick={submit} onClearRecent={clearRecent} />
        ) : (
          <ResultsSection
            q={q}
            page={page}
            totalPages={totalPages}
            total={resultsQuery.data?.total ?? 0}
            items={accumulated}
            isLoading={resultsQuery.isLoading && page === 1}
            isFetching={resultsQuery.isFetching}
            canLoadMore={canLoadMore}
            onLoadMore={() =>
              navigate({ search: (prev: { q: string; page: number }) => ({ ...prev, page: (prev.page ?? 1) + 1 }) })
            }
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({
  recent,
  onPick,
  onClearRecent,
}: {
  recent: string[];
  onPick: (q: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <div className="space-y-8 pt-4">
      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" /> Tìm gần đây
            </h2>
            <button
              onClick={onClearRecent}
              className="text-xs text-muted-foreground transition hover:text-primary"
            >
              Xóa tất cả
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r}
                onClick={() => onPick(r)}
                className="glass rounded-full border border-foreground/10 px-4 py-2 text-sm text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
              >
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-accent" /> Xu hướng
        </h2>
        <div className="flex flex-wrap gap-2">
          {TRENDING.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-white transition hover:bg-primary/20"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 pt-12 text-center">
        <div className="glass flex h-16 w-16 items-center justify-center rounded-2xl">
          <SearchIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Nhập tên phim, series hoặc diễn viên để bắt đầu</p>
      </div>
    </div>
  );
}

function ResultsSection({
  q,
  total,
  items,
  isLoading,
  isFetching,
  canLoadMore,
  onLoadMore,
}: {
  q: string;
  page: number;
  totalPages: number;
  total: number;
  items: SearchResult["items"];
  isLoading: boolean;
  isFetching: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
}) {
  if (isLoading) return <ResultsSkeleton />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="glass flex h-16 w-16 items-center justify-center rounded-2xl">
          <SearchIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="font-display text-lg font-semibold text-foreground">
          Không tìm thấy kết quả nào
        </p>
        <p className="text-sm text-muted-foreground">
          Không có phim nào khớp với “{q}”. Thử từ khóa khác nhé.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">
          Kết quả cho “<span className="text-primary">{q}</span>”
        </h2>
        <span className="text-sm text-muted-foreground">{total} phim</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item, i) => (
          <MovieCard key={item.id} item={item} index={i} />
        ))}
      </div>

      <div className="flex justify-center pt-4">
        {canLoadMore ? (
          <button
            onClick={onLoadMore}
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-medium text-white transition hover:border-primary/50 hover:bg-primary/10"
          >
            Xem thêm
          </button>
        ) : isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : items.length > 0 ? (
          <span className="text-sm text-muted-foreground">Đã hết kết quả</span>
        ) : null}
      </div>
    </div>
  );
}

function MovieCard({ item, index }: { item: SearchResult["items"][number]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.4) }}
    >
      <Link
        to="/phim/$slug"
        params={{ slug: item.slug }}
        className="group block overflow-hidden rounded-xl border border-foreground/10 bg-elevated transition hover:border-primary/40"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
          <img
            src={thumbSrc(item.poster_url,{w:400})}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
            {item.type}
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-accent backdrop-blur">
            <Star className="h-3 w-3 fill-accent" />
            {item.rating.toFixed(1)}
          </div>
        </div>
        <div className="p-2.5">
          <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {item.title}
          </div>
          <div className="text-xs text-muted-foreground">{item.year}</div>
        </div>
      </Link>
    </motion.div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-64 animate-pulse rounded bg-surface-elevated" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface-elevated" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-surface-elevated" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-elevated" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Silence unused import warning for useMemo (kept for potential future filters)
void useMemo;
