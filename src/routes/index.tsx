import { createFileRoute } from "@tanstack/react-router";
import { Play } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="space-y-8">
      <section className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-10">
        <div className="max-w-xl space-y-4">
          <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Featured
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">
            Cinematic nights, curated for you.
          </h1>
          <p className="text-foreground-muted">
            Discover blockbusters, indie gems, and originals in stunning 4K.
          </p>
          <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow-primary)] transition hover:brightness-110">
            <Play className="h-4 w-4 fill-current" /> Watch trailer
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Trending now</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl bg-gradient-to-br from-surface-elevated to-white/5"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
