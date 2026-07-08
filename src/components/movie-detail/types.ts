export type Movie = {
  slug: string;
  title: string;
  original_title: string;
  year: number;
  duration: string;
  quality: string;
  language: string;
  rating: number;
  age_rating: string;
  backdrop_url: string;
  poster_url: string;
  logo_url: string;
  trailer_url?: string;
  overview: string;
  overview_vi?: string;
  categories: string[];
  country: string;
  director: string;
  cast: string[];
  total_episodes: number;
  parts: { slug: string; label: string; year: number }[];
};

export type RelatedItem = {
  slug: string;
  title: string;
  poster_url: string;
  year: number;
  rating: number;
};

/** Parse YouTube URL → embed src with autoplay+loop. */
export function youTubeEmbed(
  url: string,
  opts: { muted: boolean },
): string | null {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.replace("/", "");
    else if (u.hostname.includes("youtube.com"))
      id = u.searchParams.get("v") ?? "";
    if (!id) return null;
    const params = new URLSearchParams({
      autoplay: "1",
      mute: opts.muted ? "1" : "0",
      controls: "0",
      loop: "1",
      playlist: id,
      modestbranding: "1",
      rel: "0",
      playsinline: "1",
    });
    return `https://www.youtube.com/embed/${id}?${params}`;
  } catch {
    return null;
  }
}

/** Deterministic string→positive int (djb2), for synthesizing keys/ids. */
export function hashId(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
