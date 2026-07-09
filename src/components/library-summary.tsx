import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Bell, Bookmark, Heart, History as HistoryIcon } from "lucide-react";

import { transition } from "@/lib/design";
import { useTranslation } from "@/hooks/useTranslation";

type SummaryStat = {
  key: "history" | "favorites" | "watchlist" | "notifications";
  label: string;
  value: number | undefined;
  loading: boolean;
  to: "/history" | "/favorites" | "/watchlist" | "/notifications";
  icon: React.ReactNode;
  accent: string;
};

export function LibrarySummary() {
  const { t } = useTranslation();

  const history = useQuery<{ items: unknown[] }>({
    queryKey: ["history"],
    queryFn: async () => (await fetch("/api/history")).json(),
    staleTime: 60_000,
  });
  const favorites = useQuery<{ items: unknown[] }>({
    queryKey: ["favorites"],
    queryFn: async () => (await fetch("/api/favorites")).json(),
    staleTime: 60_000,
  });
  const watchlist = useQuery<{ items: unknown[] }>({
    queryKey: ["watchlist"],
    queryFn: async () => (await fetch("/api/watchlist")).json(),
    staleTime: 60_000,
  });
  const unread = useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await fetch("/api/notifications/unread-count")).json(),
    staleTime: 30_000,
  });

  const stats: SummaryStat[] = [
    {
      key: "history",
      label: t("library.summary.watched"),
      value: history.data?.items.length,
      loading: history.isLoading,
      to: "/history",
      icon: <HistoryIcon className="h-4 w-4" />,
      accent: "from-primary/40 to-primary/5",
    },
    {
      key: "favorites",
      label: t("library.summary.favorites"),
      value: favorites.data?.items.length,
      loading: favorites.isLoading,
      to: "/favorites",
      icon: <Heart className="h-4 w-4 fill-current" />,
      accent: "from-rose-500/40 to-rose-500/5",
    },
    {
      key: "watchlist",
      label: t("library.summary.watchlist"),
      value: watchlist.data?.items.length,
      loading: watchlist.isLoading,
      to: "/watchlist",
      icon: <Bookmark className="h-4 w-4 fill-current" />,
      accent: "from-accent/40 to-accent/5",
    },
    {
      key: "notifications",
      label: t("library.summary.unread"),
      value: unread.data?.count,
      loading: unread.isLoading,
      to: "/notifications",
      icon: <Bell className="h-4 w-4" />,
      accent: "from-amber-400/40 to-amber-400/5",
    },
  ];

  return (
    <section aria-label={t("library.summary.title")} className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
        {t("library.summary.eyebrow")}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition.scene, delay: 0.04 * i }}
          >
            <Link
              to={s.to}
              className="glass group relative block overflow-hidden rounded-2xl border border-foreground/10 p-4 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br opacity-60 ${s.accent}`}
              />
              <div className="flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-foreground">
                {s.icon}
                <span className="text-[11px] font-medium uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
              <div className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">
                {s.loading ? (
                  <span className="inline-block h-8 w-10 animate-pulse rounded bg-foreground/10 align-middle" />
                ) : (
                  (s.value ?? 0)
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/library-summary-noop")({
  component: () => null,
});
