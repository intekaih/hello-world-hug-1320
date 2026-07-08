import { type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Base shimmer block                                                        */
/* -------------------------------------------------------------------------- */

export function Shimmer({
  className,
  as: As = "div",
}: {
  className?: string;
  as?: "div" | "span";
}) {
  return <As className={cn("skeleton-shimmer", className)} aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/*  MovieCardSkeleton                                                         */
/* -------------------------------------------------------------------------- */

export function MovieCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      <Shimmer className="aspect-[2/3] w-full rounded-xl" />
      <Shimmer className="h-3.5 w-3/4 rounded-md" />
      <Shimmer className="h-3 w-1/2 rounded-md" />
    </div>
  );
}

export function MovieGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <MovieCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  HeroSkeleton                                                              */
/* -------------------------------------------------------------------------- */

export function HeroSkeleton() {
  return (
    <div className="relative -mx-4 h-[62vh] min-h-[420px] overflow-hidden sm:-mx-6 sm:h-[70vh] lg:-mx-8 lg:rounded-3xl">
      <Shimmer className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 flex items-end p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-xl space-y-3">
          <Shimmer className="h-20 w-64 rounded-lg sm:h-28" />
          <Shimmer className="h-4 w-40 rounded-md" />
          <Shimmer className="h-4 w-full rounded-md" />
          <Shimmer className="h-4 w-4/5 rounded-md" />
          <div className="flex gap-2 pt-2">
            <Shimmer className="h-10 w-28 rounded-full" />
            <Shimmer className="h-10 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  EpisodeListSkeleton                                                       */
/* -------------------------------------------------------------------------- */

export function EpisodeListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass space-y-2 rounded-xl p-2">
          <Shimmer className="aspect-video w-full rounded-lg" />
          <Shimmer className="h-3 w-2/3 rounded-md" />
          <Shimmer className="h-3 w-1/3 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page-level loader with logo                                               */
/* -------------------------------------------------------------------------- */

export function PageLoader({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative"
      >
        <div className="absolute inset-0 -z-10 rounded-3xl bg-primary/30 blur-2xl" />
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-[var(--shadow-glow-primary)]">
          <Film className="h-8 w-8 text-white" />
        </div>
      </motion.div>
      <div className="flex items-center gap-2 text-sm text-foreground-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CrossFade — swap skeleton to real content with a soft cross-fade         */
/* -------------------------------------------------------------------------- */

export function CrossFade({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {loading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
