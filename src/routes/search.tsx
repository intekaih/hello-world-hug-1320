import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  Search as SearchIcon,
  X,
  Loader2,
  Clock,
  TrendingUp,
  Sparkles,
  Flame,
  Compass,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { z } from "zod";

import { buildPageMeta } from "@/lib/page-meta";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useTranslation } from "@/hooks/useTranslation";
import { ExperienceCard } from "@/components/home/experience-card";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/design";

/* ─────────────────────────────────────────────────────────────────── */
/*  Route + schema                                                       */
/* ─────────────────────────────────────────────────────────────────── */

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
  type: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  country: fallback(z.string(), "").default(""),
  year: fallback(z.string(), "").default(""),
  quality: fallback(z.string(), "").default(""),
  language: fallback(z.string(), "").default(""),
});
type SearchParams = z.infer<typeof searchSchema>;

type SuggestItem = {
  id: number;
  title: string;
  year: number;
  type: string;
  poster_url: string;
  slug: string;
};

type ResultItem = {
  id: number;
  title: string;
  slug: string;
  year: number;
  rating: number;
  poster_url: string;
  type: string;
  quality: string;
  language: string;
  category: string[];
  country: string[];
};

type SearchResult = {
  items: ResultItem[];
  page: number;
  totalPages: number;
  total: number;
};

const RECENT_KEY = "moviecc:recent-searches";
const TRENDING = [
  "Dune", "Shogun", "Fallout", "Deadpool", "Wednesday",
  "Demon Slayer", "Oppenheimer", "The Bear",
];
const MOODS: { key: string; hue: string; query: string; icon: string }[] = [
  { key: "cozy",        hue: "oklch(0.72 0.14 55)",  query: "Tình cảm",           icon: "☕" },
  { key: "adrenaline",  hue: "oklch(0.65 0.22 25)",  query: "Hành động",          icon: "⚡" },
  { key: "mindBender",  hue: "oklch(0.7 0.16 280)",  query: "Bí ẩn",              icon: "◈" },
  { key: "heartfelt",   hue: "oklch(0.78 0.13 15)",  query: "Chính kịch",         icon: "❤" },
  { key: "darkTwisted", hue: "oklch(0.55 0.15 300)", query: "Kinh dị",            icon: "☾" },
  { key: "epicJourney", hue: "oklch(0.72 0.18 70)",  query: "Phiêu lưu",          icon: "✦" },
];
const GENRES = [
  "Hành động", "Phiêu lưu", "Chính kịch", "Kinh dị", "Hài", "Tình cảm",
  "Khoa học viễn tưởng", "Bí ẩn", "Tội phạm", "Lịch sử",
];
const COUNTRIES = ["Mỹ", "Anh", "Hàn Quốc", "Nhật Bản", "Trung Quốc", "Việt Nam", "Pháp", "Tây Ban Nha"];
const YEARS = ["2024", "2023", "2022", "2021", "2020", "2019"];
const QUALITIES = ["4K", "FHD", "HD"];
const LANGUAGES = ["Vietsub", "Lồng tiếng", "Thuyết minh"];
const TYPES: { value: string; labelKey: string }[] = [
  { value: "phim-bo", labelKey: "phim-bo" },
  { value: "phim-le", labelKey: "phim-le" },
  { value: "hoat-hinh", labelKey: "hoat-hinh" },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
      title: "Tìm kiếm — MovieCC",
      description:
        "Tìm phim, series, anime bạn muốn xem trên MovieCC. Kho phim HD Vietsub miễn phí.",
      url: "/search",
    }),
  }),
  component: SearchExperiencePage,
});

/* ─────────────────────────────────────────────────────────────────── */
/*  Root page                                                            */
/* ─────────────────────────────────────────────────────────────────── */

function SearchExperiencePage() {
  const search = Route.useSearch();
  const { q, page } = search;
  const navigate = useNavigate({ from: "/search" });
  const { t } = useTranslation();

  const [input, setInput] = useState(q);
  const [debounced, setDebounced] = useState(q);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [accumulated, setAccumulated] = useState<ResultItem[]>([]);
  const lastKey = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  usePageMeta(
    q.trim()
      ? {
          title: t("search.titleWithQuery", { q }),
          description: t("search.description"),
          url: `/search?q=${encodeURIComponent(q)}`,
          noindex: true,
        }
      : null,
  );

  // Debounce → 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => setInput(q), [q]);
  useEffect(() => setRecent(loadRecent()), []);

  // Live suggestions
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

  // Full search — filters + q
  const filterKey = useMemo(
    () => JSON.stringify({
      q, type: search.type, category: search.category, country: search.country,
      year: search.year, quality: search.quality, language: search.language,
    }),
    [q, search.type, search.category, search.country, search.year, search.quality, search.language],
  );

  const resultsQuery = useQuery<SearchResult>({
    queryKey: ["search", filterKey, page],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        q, page: String(page),
        type: search.type, category: search.category, country: search.country,
        year: search.year, quality: search.quality, language: search.language,
      });
      const res = await fetch(`/api/search?${params}`, { signal });
      if (!res.ok) throw new Error("search failed");
      return await res.json();
    },
    enabled: hasAnyFilter(search),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // Accumulate for load-more
  useEffect(() => {
    if (!resultsQuery.data) return;
    if (lastKey.current !== filterKey) {
      lastKey.current = filterKey;
      setAccumulated(resultsQuery.data.items);
    } else if (page === 1) {
      setAccumulated(resultsQuery.data.items);
    } else {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...resultsQuery.data!.items.filter((x) => !seen.has(x.id))];
      });
    }
  }, [resultsQuery.data, filterKey, page]);

  const submit = useCallback(
    (nextQ: string) => {
      const trimmed = nextQ.trim();
      if (!trimmed) return;
      saveRecent(trimmed);
      setRecent(loadRecent());
      setFocused(false);
      inputRef.current?.blur();
      navigate({ search: (prev: SearchParams) => ({ ...prev, q: trimmed, page: 1 }) });
    },
    [navigate],
  );

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  const setFilter = useCallback(
    (patch: Partial<SearchParams>) =>
      navigate({ search: (prev: SearchParams) => ({ ...prev, ...patch, page: 1 }) }),
    [navigate],
  );

  const active = hasAnyFilter(search);
  const totalPages = resultsQuery.data?.totalPages ?? 0;
  const canLoadMore = active && page < totalPages && !resultsQuery.isFetching;

  return (
    <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8">
      <h1 className="sr-only">
        {q ? t("search.resultsFor", { q }) : t("search.heroTitle")}
      </h1>

      <CinematicSearchHero
        input={input}
        setInput={setInput}
        submit={submit}
        focused={focused}
        setFocused={setFocused}
        onClear={() => {
          setInput("");
          inputRef.current?.focus();
        }}
        inputRef={inputRef}
        suggestions={suggestQuery.data?.items ?? []}
        loadingSuggestions={suggestQuery.isFetching && debounced.length > 0}
        debounced={debounced}
        hasResults={active}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        {active ? (
          <ResultsSection
            q={q}
            search={search}
            setFilter={setFilter}
            items={accumulated}
            total={resultsQuery.data?.total ?? 0}
            isLoading={resultsQuery.isLoading && page === 1}
            isFetching={resultsQuery.isFetching}
            canLoadMore={canLoadMore}
            onLoadMore={() =>
              navigate({ search: (prev: SearchParams) => ({ ...prev, page: (prev.page ?? 1) + 1 }) })
            }
          />
        ) : (
          <DiscoveryPortal
            recent={recent}
            onPick={submit}
            onClearRecent={clearRecent}
            setFilter={setFilter}
          />
        )}
      </div>
    </div>
  );
}

function hasAnyFilter(s: SearchParams) {
  return Boolean(
    s.q.trim() || s.type || s.category || s.country || s.year || s.quality || s.language,
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  CinematicSearchHero + SuggestionPanel                                */
/* ─────────────────────────────────────────────────────────────────── */

function CinematicSearchHero({
  input, setInput, submit, focused, setFocused, onClear,
  inputRef, suggestions, loadingSuggestions, debounced, hasResults,
}: {
  input: string;
  setInput: (v: string) => void;
  submit: (q: string) => void;
  focused: boolean;
  setFocused: (v: boolean) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: SuggestItem[];
  loadingSuggestions: boolean;
  debounced: string;
  hasResults: boolean;
}) {
  const { t } = useTranslation();
  const [activeIdx, setActiveIdx] = useState(-1);
  const listboxId = useId();

  const showSuggestions =
    focused && debounced.trim().length > 0 && suggestions.length > 0;

  useEffect(() => setActiveIdx(-1), [debounced]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        submit(suggestions[activeIdx].title);
      } else {
        submit(input);
      }
    } else if (e.key === "Escape") {
      setInput("");
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-white/5 transition-all duration-700",
        hasResults ? "pb-6 pt-6 md:pb-8 md:pt-10" : "pb-12 pt-16 md:pb-20 md:pt-24",
      )}
      data-focused={focused}
    >
      {/* Ambient background — morphs with focus */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700"
        style={{
          background: focused
            ? "radial-gradient(ellipse at 50% 30%, oklch(0.55 0.22 15 / 0.35), transparent 60%), radial-gradient(ellipse at 20% 80%, oklch(0.5 0.2 280 / 0.25), transparent 55%)"
            : "radial-gradient(ellipse at 50% 20%, oklch(0.5 0.2 280 / 0.2), transparent 60%)",
        }}
      />
      <FloatingParticles active={focused} />

      <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8">
        {!hasResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ease.outSoft }}
            className="mb-8 text-center"
          >
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.32em] text-primary/80">
              {t("search.heroEyebrow")}
            </p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
              {t("search.heroTitle")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              {t("search.heroSubtitle")}
            </p>
          </motion.div>
        )}

        <div
          role="combobox"
          aria-expanded={showSuggestions}
          aria-owns={listboxId}
          aria-haspopup="listbox"
          className="relative"
        >
          <motion.div
            animate={{
              scale: focused ? 1.005 : 1,
              boxShadow: focused
                ? "0 30px 80px -30px oklch(0.55 0.22 15 / 0.5), 0 0 0 1px oklch(0.65 0.22 15 / 0.4)"
                : "0 10px 30px -20px oklch(0 0 0 / 0.6), 0 0 0 1px oklch(1 0 0 / 0.08)",
            }}
            transition={{ duration: 0.35, ease: ease.outSoft }}
            className="glass relative overflow-hidden rounded-full"
          >
            <SearchIcon
              className={cn(
                "pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors md:h-6 md:w-6",
                focused ? "text-primary" : "text-muted-foreground",
              )}
            />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={onKeyDown}
              placeholder={t("search.placeholder")}
              className="h-14 w-full bg-transparent pl-14 pr-14 text-base text-white placeholder:text-white/40 outline-none md:h-16 md:pl-16 md:pr-16 md:text-lg"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={t("search.submit")}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined
              }
            />
            {input && (
              <button
                type="button"
                onClick={onClear}
                className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                aria-label={t("search.clear")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {loadingSuggestions && !input && (
              <Loader2 className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </motion.div>

          <SearchSuggestionPanel
            visible={showSuggestions}
            listboxId={listboxId}
            suggestions={suggestions}
            debounced={debounced}
            activeIdx={activeIdx}
            onSelect={(item) => submit(item.title)}
            setActiveIdx={setActiveIdx}
          />
        </div>

        {!hasResults && (
          <p className="mt-4 text-center text-xs text-muted-foreground md:text-sm">
            {t("search.notSureCta")}
          </p>
        )}
      </div>
    </section>
  );
}

function FloatingParticles({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-primary/40"
          style={{
            left: `${(i * 83) % 100}%`,
            top: `${(i * 47) % 100}%`,
          }}
          animate={
            active
              ? { opacity: [0, 0.9, 0], y: [-4, -30], scale: [0.6, 1.4] }
              : { opacity: 0 }
          }
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: (i % 5) * 0.4,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

function SearchSuggestionPanel({
  visible, listboxId, suggestions, debounced, activeIdx, onSelect, setActiveIdx,
}: {
  visible: boolean;
  listboxId: string;
  suggestions: SuggestItem[];
  debounced: string;
  activeIdx: number;
  onSelect: (item: SuggestItem) => void;
  setActiveIdx: (i: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: ease.outSoft }}
          className="glass-strong absolute left-0 right-0 top-[calc(100%+10px)] z-40 overflow-hidden rounded-3xl shadow-[var(--shadow-elevated)]"
        >
          <div className="border-b border-white/5 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("search.suggestions")}
          </div>
          <ul
            id={listboxId}
            role="listbox"
            className="max-h-[60vh] overflow-y-auto py-1"
          >
            {suggestions.map((item, i) => (
              <li
                key={item.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIdx}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => onSelect(item)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                    i === activeIdx ? "bg-primary/15" : "hover:bg-white/5",
                  )}
                >
                  <img
                    src={thumbSrc(item.poster_url, { w: 200 })}
                    alt=""
                    className="h-14 w-10 flex-shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium text-foreground">
                      <HighlightedText text={item.title} query={debounced} />
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {item.type} · {item.year}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/25 px-0.5 text-primary-foreground/95">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  DiscoveryPortal — empty state                                        */
/* ─────────────────────────────────────────────────────────────────── */

function DiscoveryPortal({
  recent, onPick, onClearRecent, setFilter,
}: {
  recent: string[];
  onPick: (q: string) => void;
  onClearRecent: () => void;
  setFilter: (patch: Partial<SearchParams>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-12 pt-2">
      {recent.length > 0 && (
        <DiscoverySection
          eyebrow={<Clock className="h-3.5 w-3.5" />}
          title={t("search.recent")}
          action={
            <button
              onClick={onClearRecent}
              className="text-xs text-muted-foreground transition hover:text-primary"
            >
              {t("search.clearRecent")}
            </button>
          }
        >
          <ChipRow>
            {recent.map((r) => (
              <PortalChip key={r} onClick={() => onPick(r)}>
                {r}
              </PortalChip>
            ))}
          </ChipRow>
        </DiscoverySection>
      )}

      <DiscoverySection
        eyebrow={<Flame className="h-3.5 w-3.5" />}
        title={t("search.trending")}
      >
        <ChipRow>
          {TRENDING.map((tq, i) => (
            <PortalChip
              key={tq}
              onClick={() => onPick(tq)}
              accent
              rank={i + 1}
            >
              {tq}
            </PortalChip>
          ))}
        </ChipRow>
      </DiscoverySection>

      <DiscoverySection
        eyebrow={<Sparkles className="h-3.5 w-3.5" />}
        title={t("search.moodPicks")}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setFilter({ q: "", category: slugify(m.query) })}
              className="glass group relative overflow-hidden rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-white/25"
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-40 transition-opacity duration-500 group-hover:opacity-80"
                style={{
                  background: `radial-gradient(120% 100% at 100% 0%, ${m.hue}, transparent 65%)`,
                }}
              />
              <div className="relative">
                <div className="text-2xl">{m.icon}</div>
                <div className="mt-3 font-display text-sm font-medium text-foreground">
                  {t(`search.moods.${m.key}`)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DiscoverySection>

      <DiscoverySection
        eyebrow={<Compass className="h-3.5 w-3.5" />}
        title={t("search.genreUniverse")}
      >
        <ChipRow>
          {GENRES.map((g) => (
            <PortalChip
              key={g}
              onClick={() => setFilter({ q: "", category: slugify(g) })}
            >
              {g}
            </PortalChip>
          ))}
        </ChipRow>
      </DiscoverySection>

      <DiscoverySection
        eyebrow={<TrendingUp className="h-3.5 w-3.5" />}
        title={t("search.topCountries")}
      >
        <ChipRow>
          {COUNTRIES.map((c) => (
            <PortalChip
              key={c}
              onClick={() => setFilter({ q: "", country: slugify(c) })}
            >
              {c}
            </PortalChip>
          ))}
        </ChipRow>
      </DiscoverySection>

      <DiscoverySection
        eyebrow={<SlidersHorizontal className="h-3.5 w-3.5" />}
        title={t("search.quickFilters")}
      >
        <div className="flex flex-wrap gap-2">
          {TYPES.map((tp) => (
            <PortalChip
              key={tp.value}
              onClick={() => setFilter({ q: "", type: tp.value })}
              accent
            >
              {t(`search.typeLabels.${tp.labelKey}`)}
            </PortalChip>
          ))}
          {QUALITIES.map((qv) => (
            <PortalChip key={qv} onClick={() => setFilter({ q: "", quality: qv })}>
              {qv}
            </PortalChip>
          ))}
          {LANGUAGES.map((lv) => (
            <PortalChip key={lv} onClick={() => setFilter({ q: "", language: lv })}>
              {lv}
            </PortalChip>
          ))}
        </div>
      </DiscoverySection>
    </div>
  );
}

function DiscoverySection({
  eyebrow, title, action, children,
}: {
  eyebrow: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: ease.outSoft }}
    >
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-primary/80">
            {eyebrow} <span className="opacity-70">·</span>
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function PortalChip({
  children, onClick, accent, rank,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
  rank?: number;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md transition",
        accent
          ? "border-primary/40 bg-primary/12 text-foreground hover:border-primary/70 hover:bg-primary/20"
          : "border-white/10 bg-white/5 text-foreground/85 hover:border-white/25 hover:bg-white/10",
      )}
    >
      {rank != null && (
        <span className="font-mono text-[10px] text-primary/80">
          {String(rank).padStart(2, "0")}
        </span>
      )}
      {children}
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Results                                                              */
/* ─────────────────────────────────────────────────────────────────── */

function ResultsSection({
  q, search, setFilter, items, total, isLoading, isFetching, canLoadMore, onLoadMore,
}: {
  q: string;
  search: SearchParams;
  setFilter: (patch: Partial<SearchParams>) => void;
  items: ResultItem[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();
  const activeCount =
    [search.type, search.category, search.country, search.year, search.quality, search.language]
      .filter(Boolean).length;

  return (
    <div className="space-y-6">
      <DiscoveryFilterChips search={search} setFilter={setFilter} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
            {q ? (
              <>
                {t("search.resultsFor", { q: "" }).replace("“”", "")}
                <span className="text-primary">“{q}”</span>
              </>
            ) : (
              t("search.results")
            )}
          </h2>
          {activeCount > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("search.filters.activeCount", { n: activeCount })}
            </p>
          )}
        </div>
        <span
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground"
          aria-live="polite"
        >
          <span className="sr-only">{t("search.resultsCountSr", { n: total })}</span>
          <span aria-hidden>{t("search.resultsCount", { n: total })}</span>
        </span>
      </div>

      {isLoading ? (
        <ResultsSkeleton />
      ) : items.length === 0 ? (
        <SearchEmptyState />
      ) : (
        <SearchResultsGrid items={items} />
      )}

      <div className="flex justify-center pt-4">
        {canLoadMore ? (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLoadMore}
            className="rounded-full border border-primary/40 bg-primary/10 px-8 py-3 text-sm font-medium text-foreground transition hover:border-primary/70 hover:bg-primary/20"
          >
            {t("search.loadMore")}
          </motion.button>
        ) : isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("search.loadingMore")}
          </div>
        ) : items.length > 0 ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("search.endOfResults")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DiscoveryFilterChips({
  search, setFilter,
}: {
  search: SearchParams;
  setFilter: (patch: Partial<SearchParams>) => void;
}) {
  const { t } = useTranslation();
  const clear = () =>
    setFilter({ type: "", category: "", country: "", year: "", quality: "", language: "" });
  const anyActive = Boolean(
    search.type || search.category || search.country || search.year || search.quality || search.language,
  );
  return (
    <div className="glass-strong space-y-3 rounded-2xl border border-white/10 p-4">
      <FilterChipGroup label={t("search.filters.type")}>
        {TYPES.map((tp) => (
          <FilterChip
            key={tp.value}
            active={search.type === tp.value}
            onClick={() =>
              setFilter({ type: search.type === tp.value ? "" : tp.value })
            }
          >
            {t(`search.typeLabels.${tp.labelKey}`)}
          </FilterChip>
        ))}
      </FilterChipGroup>
      <FilterChipGroup label={t("search.filters.genre")}>
        {GENRES.map((g) => {
          const slug = slugify(g);
          return (
            <FilterChip
              key={g}
              active={search.category === slug}
              onClick={() =>
                setFilter({ category: search.category === slug ? "" : slug })
              }
            >
              {g}
            </FilterChip>
          );
        })}
      </FilterChipGroup>
      <div className="grid gap-3 md:grid-cols-2">
        <FilterChipGroup label={t("search.filters.year")}>
          {YEARS.map((y) => (
            <FilterChip
              key={y}
              active={search.year === y}
              onClick={() => setFilter({ year: search.year === y ? "" : y })}
            >
              {y}
            </FilterChip>
          ))}
        </FilterChipGroup>
        <FilterChipGroup label={t("search.filters.country")}>
          {COUNTRIES.slice(0, 6).map((c) => {
            const slug = slugify(c);
            return (
              <FilterChip
                key={c}
                active={search.country === slug}
                onClick={() =>
                  setFilter({ country: search.country === slug ? "" : slug })
                }
              >
                {c}
              </FilterChip>
            );
          })}
        </FilterChipGroup>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FilterChipGroup label={t("search.filters.quality")}>
          {QUALITIES.map((qv) => (
            <FilterChip
              key={qv}
              active={search.quality === qv}
              onClick={() => setFilter({ quality: search.quality === qv ? "" : qv })}
            >
              {qv}
            </FilterChip>
          ))}
        </FilterChipGroup>
        <FilterChipGroup label={t("search.filters.language")}>
          {LANGUAGES.map((lv) => (
            <FilterChip
              key={lv}
              active={search.language === lv}
              onClick={() => setFilter({ language: search.language === lv ? "" : lv })}
            >
              {lv}
            </FilterChip>
          ))}
        </FilterChipGroup>
      </div>
      {anyActive && (
        <div className="flex justify-end">
          <button
            onClick={clear}
            className="text-xs text-muted-foreground transition hover:text-primary"
          >
            {t("search.filters.clear")}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChipGroup({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
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

function SearchResultsGrid({ items }: { items: ResultItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45,
            delay: Math.min(i * 0.03, 0.5),
            ease: ease.outSoft,
          }}
        >
          <ExperienceCard
            movie={{
              id: item.id,
              slug: item.slug,
              title: item.title,
              poster_url: item.poster_url,
              year: item.year,
              rating: item.rating,
            }}
            meta={{ year: item.year, genres: item.category }}
            size="md"
            className="w-full"
          />
        </motion.div>
      ))}
    </div>
  );
}

function SearchEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <div className="glass grid h-16 w-16 place-items-center rounded-2xl">
        <SearchIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-display text-lg font-semibold text-foreground">
        {t("search.noResults")}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("search.noResultsHint")}
      </p>
      <Link
        to="/kham-pha"
        className="mt-3 rounded-full border border-primary/40 bg-primary/10 px-6 py-2 text-sm font-medium text-foreground transition hover:border-primary/70 hover:bg-primary/20"
      >
        {t("continueWatching.empty.cta")}
      </Link>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
