/**
 * Trailer source normalization.
 *
 * Streaming pages get trailer URLs from many places (direct .mp4, YouTube,
 * Vimeo, or nothing). The hero component needs one shape it can render
 * deterministically without try/catching per-provider quirks.
 */

export type TrailerSource =
  | { kind: "direct"; src: string; mime: string; external?: string }
  | { kind: "youtube"; id: string; external: string }
  | { kind: "vimeo"; id: string; external: string }
  | { kind: "none" };

const DIRECT_RE = /\.(mp4|webm|m3u8|mov)(\?.*)?$/i;

export function isDirectVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return DIRECT_RE.test(url);
}

export function getDirectMime(url: string): string {
  if (/\.m3u8($|\?)/i.test(url)) return "application/vnd.apple.mpegurl";
  if (/\.webm($|\?)/i.test(url)) return "video/webm";
  return "video/mp4";
}

export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace(/^\//, "") || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function getVimeoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const id = u.pathname.split("/").filter(Boolean).pop();
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

type MovieLike = {
  trailer_url?: string | null;
  trailerUrl?: string | null;
  trailer?: string | null;
  video_url?: string | null;
  preview_url?: string | null;
};

/** Pick the first non-empty trailer field the API happens to expose. */
export function pickTrailerUrl(movie: MovieLike): string | null {
  return (
    movie.trailer_url ||
    movie.trailerUrl ||
    movie.trailer ||
    movie.video_url ||
    movie.preview_url ||
    null
  );
}

export function normalizeTrailerSource(movie: MovieLike): TrailerSource {
  const url = pickTrailerUrl(movie);
  if (!url) return { kind: "none" };

  if (isDirectVideoUrl(url)) {
    return { kind: "direct", src: url, mime: getDirectMime(url) };
  }

  const yt = getYouTubeId(url);
  if (yt) {
    return {
      kind: "youtube",
      id: yt,
      external: `https://www.youtube.com/watch?v=${yt}`,
    };
  }

  const vi = getVimeoId(url);
  if (vi) {
    return {
      kind: "vimeo",
      id: vi,
      external: `https://vimeo.com/${vi}`,
    };
  }

  // Unknown provider — expose as external link only, no autoplay attempt.
  return { kind: "none" };
}
