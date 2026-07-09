import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Sparkles, Share2 } from "lucide-react";
import { toast } from "sonner";

type FavoriteItem = { movie_slug: string; movie_name: string };
type MovieDetail = { categories?: string[] };

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

export function TasteBadge() {
  const favs = useQuery<{ items: FavoriteItem[] }>({
    queryKey: ["favorites"],
    queryFn: () => fetchJson("/api/favorites"),
    staleTime: 60_000,
  });

  const slugs = (favs.data?.items ?? []).slice(0, 24).map((f) => f.movie_slug);

  const details = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ["movie", slug],
      queryFn: () => fetchJson<MovieDetail>(`/api/movies/${slug}`),
      staleTime: 5 * 60_000,
      retry: 0,
    })),
  });

  const { topGenres, sampleSize } = useMemo(() => {
    const counts = new Map<string, number>();
    let n = 0;
    for (const d of details) {
      const cats = d.data?.categories;
      if (!cats?.length) continue;
      n++;
      for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return { topGenres: sorted.slice(0, 3), sampleSize: n };
  }, [details]);

  const totalFavs = favs.data?.items.length ?? 0;
  const loading = favs.isLoading || (slugs.length > 0 && details.some((d) => d.isLoading));

  if (loading) {
    return (
      <section className="glass rounded-2xl border border-foreground/10 p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-foreground/10" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-foreground/10" />
      </section>
    );
  }

  if (totalFavs === 0 || topGenres.length === 0) {
    return (
      <section className="glass rounded-2xl border border-foreground/10 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Gu xem của bạn
        </div>
        <p className="mt-2 text-sm text-foreground/80">
          Yêu thích thêm vài bộ phim để movieCC hiểu bạn hơn — chúng tôi sẽ hé lộ “chân dung gu xem” của bạn tại đây.
        </p>
      </section>
    );
  }

  const primary = topGenres[0];
  const secondary = topGenres.slice(1);
  const headline = secondary.length
    ? `Bạn là người mê ${primary} · ${secondary.join(" · ")}`
    : `Bạn là người mê ${primary}`;

  const onShare = async () => {
    const text = `${headline} — gu xem của tôi trên movieCC`;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "Gu xem của tôi trên movieCC",
          text,
          url: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Đã sao chép thẻ gu xem");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-primary/15 via-surface-elevated to-background p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary/90">
            <Sparkles className="h-3.5 w-3.5" /> Gu xem của bạn
          </div>
          <h3 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
            {headline}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Dựa trên {sampleSize} phim bạn đã yêu thích trên movieCC.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topGenres.map((g) => (
              <span
                key={g}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onShare}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-foreground/15 bg-surface-elevated px-4 text-sm text-foreground/85 transition hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label="Chia sẻ thẻ gu xem"
        >
          <Share2 className="h-4 w-4" /> Chia sẻ
        </button>
      </div>
    </section>
  );
}
