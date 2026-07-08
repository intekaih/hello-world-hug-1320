import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, PlayCircle, Radio, Star, Ticket } from "lucide-react";

type Movie = {
  id: number; slug: string; title: string; origin_name: string;
  poster_url: string; year: number; rating: number;
  release_date?: number;
  next_episode?: number;
  air_day?: string;
  air_time?: string;
};

type Schedule = { now_playing: Movie[]; upcoming: Movie[]; on_air: Movie[] };

type TabKey = "now_playing" | "upcoming" | "on_air";

const TABS: { key: TabKey; label: string; icon: typeof Ticket }[] = [
  { key: "now_playing", label: "Đang chiếu", icon: Ticket },
  { key: "upcoming", label: "Sắp chiếu", icon: CalendarClock },
  { key: "on_air", label: "Đang phát sóng", icon: Radio },
];

export const Route = createFileRoute("/lich-chieu")({
  head: () => ({
    meta: [
      { title: "Lịch chiếu — movieCC" },
      { name: "description", content: "Lịch chiếu phim mới, sắp chiếu và các series đang phát." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const [tab, setTab] = useState<TabKey>("now_playing");
  const { data, isLoading } = useQuery<Schedule>({
    queryKey: ["schedule"],
    queryFn: async () => (await fetch("/api/schedule")).json(),
  });

  const items = data?.[tab] ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Lịch chiếu</h1>
          <p className="text-sm text-muted-foreground">
            Cập nhật phim đang chiếu, sắp ra mắt và các series đang phát sóng
          </p>
        </div>
      </div>

      {/* Segmented control */}
      <div className="glass inline-flex rounded-full border border-foreground/10 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="schedule-tab"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-primary/70 shadow-lg shadow-primary/30"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? (
            <RowSkeleton />
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Chưa có dữ liệu</div>
          ) : tab === "upcoming" ? (
            <UpcomingList items={items} />
          ) : (
            <MovieRow items={items} variant={tab} />
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function MovieRow({ items, variant }: { items: Movie[]; variant: TabKey }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.4) }}
        >
          <Link
            to="/phim/$slug"
            params={{ slug: m.slug }}
            className="group block overflow-hidden rounded-xl border border-foreground/10 bg-elevated transition hover:border-primary/40"
          >
            <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
              <img
                src={thumbSrc(m.poster_url,{w:400})}
                alt={m.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-accent backdrop-blur">
                <Star className="h-3 w-3 fill-accent" />
                {m.rating.toFixed(1)}
              </div>
              {variant === "on_air" && m.next_episode && (
                <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/70 px-2 py-1 text-[11px] text-white backdrop-blur">
                  <div className="flex items-center gap-1 text-accent">
                    <Radio className="h-3 w-3" /> {m.air_day} · {m.air_time}
                  </div>
                  <div className="text-foreground/70">Tập mới: {m.next_episode}</div>
                </div>
              )}
              {variant === "now_playing" && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 shadow-2xl shadow-primary/50">
                    <PlayCircle className="h-6 w-6 text-foreground" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                {m.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {m.origin_name} · {m.year}
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function UpcomingList({ items }: { items: Movie[] }) {
  return (
    <div className="space-y-3">
      {items.map((m, i) => {
        const date = m.release_date ? new Date(m.release_date) : null;
        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
          >
            <Link
              to="/phim/$slug"
              params={{ slug: m.slug }}
              className="glass group flex items-center gap-4 rounded-2xl border border-foreground/10 p-3 transition hover:border-primary/40"
            >
              {date && (
                <div className="flex w-16 flex-col items-center rounded-xl border border-primary/40 bg-primary/10 py-2 text-center">
                  <div className="text-2xl font-bold text-foreground">{date.getDate()}</div>
                  <div className="text-[10px] uppercase tracking-wide text-primary">
                    Th{date.getMonth() + 1}
                  </div>
                </div>
              )}
              <img
                src={thumbSrc(m.poster_url,{w:400})}
                alt=""
                loading="lazy"
                className="h-24 w-16 rounded-lg object-cover shadow-md sm:h-28 sm:w-20"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-xs uppercase tracking-widest text-accent">
                  Sắp chiếu
                </div>
                <div className="truncate font-display text-lg font-semibold text-foreground group-hover:text-primary">
                  {m.title}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {m.origin_name} · {m.year}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-accent text-accent" />
                  {m.rating.toFixed(1)}
                </div>
              </div>
              <CalendarClock className="hidden h-5 w-5 flex-shrink-0 text-muted-foreground sm:block" />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface-elevated" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-elevated" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-elevated" />
        </div>
      ))}
    </div>
  );
}
