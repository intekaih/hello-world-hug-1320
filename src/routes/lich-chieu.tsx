import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  Clock3,
  Flame,
  PlayCircle,
  Radio,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";

type Movie = {
  id: number;
  slug: string;
  title: string;
  origin_name: string;
  poster_url: string;
  year: number;
  rating: number;
  release_date?: number;
  next_episode?: number;
  air_day?: string;
  air_time?: string;
};

type Schedule = { now_playing: Movie[]; upcoming: Movie[]; on_air: Movie[] };
type TabKey = "now_playing" | "upcoming" | "on_air";

const TABS: {
  key: TabKey;
  label: string;
  eyebrow: string;
  icon: typeof Ticket;
}[] = [
  { key: "now_playing", label: "Đang chiếu", eyebrow: "In Theaters", icon: Ticket },
  { key: "upcoming", label: "Sắp chiếu", eyebrow: "Coming Soon", icon: CalendarClock },
  { key: "on_air", label: "Đang phát sóng", eyebrow: "On Air", icon: Radio },
];

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const Route = createFileRoute("/lich-chieu")({
  head: () => ({
    meta: [
      { title: "Lịch chiếu — movieCC" },
      {
        name: "description",
        content:
          "Lịch chiếu điện ảnh, timeline phim sắp ra mắt và lịch phát sóng series hằng tuần.",
      },
      { property: "og:title", content: "Lịch chiếu — movieCC" },
      {
        property: "og:description",
        content: "Timeline điện ảnh: đang chiếu, sắp chiếu, đang phát sóng.",
      },
    ],
  }),
  component: SchedulePage,
});

/* -------------------------------------------------------------------------- */

function SchedulePage() {
  const [tab, setTab] = useState<TabKey>("now_playing");
  const { data, isLoading } = useQuery<Schedule>({
    queryKey: ["schedule"],
    queryFn: async () => (await fetch("/api/schedule")).json(),
  });

  const items = data?.[tab] ?? [];
  const spotlight = data?.now_playing?.[0];

  return (
    <div className="dark -mx-4 space-y-14 bg-black pb-20 text-white sm:-mx-6 lg:-mx-8">
      {/* HERO — spotlight */}
      <SpotlightHero movie={spotlight} loading={isLoading} />

      {/* Segmented tabs */}
      <div className="px-5 sm:px-10 lg:px-14">
        <SegmentedTabs value={tab} onChange={setTab} counts={data} />
      </div>

      <div className="px-5 sm:px-10 lg:px-14">
        <AnimatePresence mode="wait">
          <motion.section
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {isLoading ? (
              <TimelineSkeleton />
            ) : items.length === 0 ? (
              <EmptyState />
            ) : tab === "upcoming" ? (
              <UpcomingTimeline items={items} />
            ) : tab === "on_air" ? (
              <WeekGrid items={items} />
            ) : (
              <NowPlayingRail items={items} />
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SPOTLIGHT HERO                                                            */
/* -------------------------------------------------------------------------- */

function SpotlightHero({ movie, loading }: { movie?: Movie; loading: boolean }) {
  return (
    <section className="relative overflow-hidden lg:rounded-b-[2rem]">
      <div className="relative h-[62vh] min-h-[480px] w-full">
        {/* Backdrop */}
        {movie ? (
          <img
            src={thumbSrc(movie.poster_url, { w: 1600 })}
            alt=""
            className="ken-burns absolute inset-0 h-full w-full scale-110 object-cover blur-[2px]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-900" />
        )}

        {/* Grading */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgb(0_0_0/0.7)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
        <div className="grain pointer-events-none absolute inset-0 opacity-40" />

        {/* Content */}
        <div className="absolute inset-0 flex items-end p-5 sm:p-10 lg:p-14">
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center gap-3">
              <span className="inline-block h-px w-10 bg-gradient-to-r from-primary to-transparent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
                <Sparkles className="mr-1.5 -mt-0.5 inline h-3 w-3" />
                Release Calendar · Tuần này
              </span>
            </div>

            <h1 className="font-display text-[clamp(2.5rem,6.5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.02em] text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              Lịch chiếu
              <br />
              <span className="italic text-white/80">điện ảnh.</span>
            </h1>

            <p className="max-w-lg text-[15px] leading-relaxed text-white/75 sm:text-base">
              Timeline những gì đang chiếu ngoài rạp, series đang phát sóng hằng
              tuần và các bom tấn sắp cập bến — cập nhật mỗi ngày.
            </p>

            {movie && !loading && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/phim/$slug"
                  params={{ slug: movie.slug }}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-primary to-[oklch(0.72_0.24_35)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_oklch(0.68_0.24_25/0.7),0_2px_8px_oklch(0.68_0.24_25/0.4)] transition hover:brightness-110"
                >
                  <PlayCircle className="h-5 w-5" />
                  Đang chiếu · {movie.title}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Link>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
                  ★ {movie.rating.toFixed(1)} · {movie.year}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SEGMENTED TABS                                                            */
/* -------------------------------------------------------------------------- */

function SegmentedTabs({
  value,
  onChange,
  counts,
}: {
  value: TabKey;
  onChange: (t: TabKey) => void;
  counts?: Schedule;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5 backdrop-blur-xl sm:inline-flex">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = value === t.key;
        const count = counts?.[t.key]?.length ?? 0;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              active ? "text-white" : "text-white/55 hover:text-white/85"
            }`}
          >
            {active && (
              <motion.span
                layoutId="schedule-tab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/90 to-[oklch(0.72_0.24_35)] shadow-[0_6px_24px_-6px_oklch(0.68_0.24_25/0.7)]"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{t.label}</span>
            {count > 0 && (
              <span
                className={`relative rounded-md px-1.5 py-0.5 font-mono text-[10px] tracking-widest ${
                  active
                    ? "bg-black/25 text-white"
                    : "bg-white/8 text-white/60"
                }`}
              >
                {String(count).padStart(2, "0")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  NOW PLAYING — Editorial poster rail                                       */
/* -------------------------------------------------------------------------- */

function NowPlayingRail({ items }: { items: Movie[] }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Box Office"
        title="Đang chiếu ngoài rạp"
        icon={<Flame className="h-3 w-3" />}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((m, i) => (
          <PosterCard key={m.id} movie={m} index={i} badge="Đang chiếu" />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  UPCOMING — Vertical timeline grouped by date bucket                       */
/* -------------------------------------------------------------------------- */

function UpcomingTimeline({ items }: { items: Movie[] }) {
  const groups = useMemo(() => groupByBucket(items), [items]);

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Coming Soon"
        title="Timeline phát hành"
        icon={<CalendarClock className="h-3 w-3" />}
      />

      <div className="relative">
        {/* Vertical rail */}
        <div className="absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/50 via-white/10 to-transparent sm:left-[26px]" />

        <div className="space-y-10">
          {groups.map((group, gi) => (
            <div key={group.key} className="space-y-5">
              {/* Bucket header */}
              <div className="relative flex items-center gap-4 pl-10 sm:pl-16">
                <span className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full border border-primary/50 bg-black shadow-[0_0_0_4px_black,0_0_24px_oklch(0.68_0.24_25/0.35)] sm:h-[52px] sm:w-[52px]">
                  <Clock3 className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                </span>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
                    {group.eyebrow}
                  </div>
                  <div className="font-display text-2xl font-semibold text-white sm:text-3xl">
                    {group.label}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="grid gap-3 pl-10 sm:pl-16 md:grid-cols-2">
                {group.items.map((m, i) => (
                  <TimelineCard
                    key={m.id}
                    movie={m}
                    index={gi * 4 + i}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ movie, index }: { movie: Movie; index: number }) {
  const date = movie.release_date ? new Date(movie.release_date) : null;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.4 }}
    >
      <Link
        to="/phim/$slug"
        params={{ slug: movie.slug }}
        className="group relative flex gap-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-3 backdrop-blur-md transition hover:border-primary/40 hover:bg-white/[0.06]"
      >
        {/* Date tile */}
        {date && (
          <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-primary/30 bg-gradient-to-b from-primary/15 to-primary/5 py-2 text-center">
            <div className="font-display text-2xl font-bold text-white">
              {date.getDate()}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/90">
              Th{date.getMonth() + 1}
            </div>
          </div>
        )}

        {/* Poster */}
        <img
          src={thumbSrc(movie.poster_url, { w: 300 })}
          alt=""
          loading="lazy"
          className="h-24 w-16 rounded-lg object-cover shadow-lg sm:h-28 sm:w-20"
        />

        {/* Body */}
        <div className="min-w-0 flex-1 self-center">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/80">
            Sắp chiếu
          </div>
          <div className="truncate font-display text-lg font-semibold text-white group-hover:text-primary">
            {movie.title}
          </div>
          <div className="truncate text-sm text-white/55">
            {movie.origin_name} · {movie.year}
          </div>
          <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-gold">
            <Star className="h-3 w-3 fill-current" />
            {movie.rating.toFixed(1)}
          </div>
        </div>

        {/* Hover glow */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ON AIR — 7-day weekly grid                                                */
/* -------------------------------------------------------------------------- */

function WeekGrid({ items }: { items: Movie[] }) {
  const byDay = useMemo(() => {
    const map: Record<string, Movie[]> = {};
    for (const d of WEEK_DAYS) map[d] = [];
    for (const m of items) if (m.air_day && map[m.air_day]) map[m.air_day].push(m);
    return map;
  }, [items]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="On Air This Week"
        title="Lịch phát sóng series"
        icon={<Radio className="h-3 w-3" />}
      />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
        {WEEK_DAYS.map((day, idx) => (
          <div
            key={day}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 backdrop-blur-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/80">
                  Day {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="font-display text-lg font-semibold text-white">
                  {day}
                </div>
              </div>
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-white/60">
                {String(byDay[day].length).padStart(2, "0")}
              </span>
            </div>
            <div className="space-y-2">
              {byDay[day].length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/8 py-6 text-center font-mono text-[10px] uppercase tracking-widest text-white/25">
                  Nghỉ
                </div>
              ) : (
                byDay[day].map((m) => <AirCard key={m.id} movie={m} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AirCard({ movie }: { movie: Movie }) {
  return (
    <Link
      to="/phim/$slug"
      params={{ slug: movie.slug }}
      className="group flex gap-2.5 rounded-xl border border-white/6 bg-black/40 p-2 transition hover:border-primary/40 hover:bg-white/[0.05]"
    >
      <img
        src={thumbSrc(movie.poster_url, { w: 200 })}
        alt=""
        loading="lazy"
        className="h-16 w-11 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-white group-hover:text-primary">
          {movie.title}
        </div>
        <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
          <Radio className="h-2.5 w-2.5" />
          {movie.air_time}
        </div>
        {movie.next_episode && (
          <div className="mt-1 font-mono text-[10px] text-white/45">
            EP {String(movie.next_episode).padStart(2, "0")}
          </div>
        )}
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  SHARED                                                                    */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  eyebrow,
  title,
  icon,
}: {
  eyebrow: string;
  title: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <span className="inline-block h-px w-8 bg-gradient-to-r from-primary to-transparent" />
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
          {icon}
          {eyebrow}
        </span>
      </div>
      <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

function PosterCard({
  movie,
  index,
  badge,
}: {
  movie: Movie;
  index: number;
  badge?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.4 }}
    >
      <Link
        to="/phim/$slug"
        params={{ slug: movie.slug }}
        className="group block"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl ring-1 ring-white/8 transition duration-500 group-hover:ring-primary/60 group-hover:shadow-[0_20px_60px_-20px_oklch(0.68_0.24_25/0.6)]">
          <img
            src={thumbSrc(movie.poster_url, { w: 500 })}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />

          {badge && (
            <div className="absolute left-2 top-2 rounded-md bg-primary/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white backdrop-blur">
              {badge}
            </div>
          )}
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-gold backdrop-blur">
            <Star className="h-3 w-3 fill-current" />
            {movie.rating.toFixed(1)}
          </div>

          <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2.5">
            <div className="truncate font-display text-sm font-semibold text-white group-hover:text-primary">
              {movie.title}
            </div>
            <div className="truncate font-mono text-[10px] uppercase tracking-widest text-white/55">
              {movie.year}
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/95 shadow-[0_10px_40px_oklch(0.68_0.24_25/0.6)]">
              <PlayCircle className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 rounded-2xl border border-white/6 bg-white/[0.02] p-3"
        >
          <div className="h-24 w-16 animate-pulse rounded-lg bg-white/10" />
          <div className="flex-1 space-y-2 py-2">
            <div className="h-3 w-1/4 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <CalendarClock className="h-8 w-8 text-white/30" />
      <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
        Chưa có lịch chiếu cho mục này
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function groupByBucket(items: Movie[]) {
  const now = Date.now();
  const DAY = 86400000;
  const buckets: {
    key: string;
    label: string;
    eyebrow: string;
    max: number;
    items: Movie[];
  }[] = [
    { key: "today", label: "Hôm nay", eyebrow: "Today", max: DAY, items: [] },
    { key: "tomorrow", label: "Ngày mai", eyebrow: "Tomorrow", max: 2 * DAY, items: [] },
    { key: "week", label: "Trong tuần này", eyebrow: "This Week", max: 7 * DAY, items: [] },
    { key: "month", label: "Trong tháng", eyebrow: "This Month", max: 30 * DAY, items: [] },
    { key: "later", label: "Sau đó", eyebrow: "Later", max: Infinity, items: [] },
  ];
  const sorted = [...items].sort(
    (a, b) => (a.release_date ?? 0) - (b.release_date ?? 0),
  );
  for (const m of sorted) {
    const diff = (m.release_date ?? now) - now;
    const bucket = buckets.find((b) => diff <= b.max) ?? buckets[buckets.length - 1];
    bucket.items.push(m);
  }
  return buckets.filter((b) => b.items.length > 0);
}
