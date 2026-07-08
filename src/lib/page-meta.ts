/**
 * Central helper for building SEO-friendly meta arrays for TanStack Router
 * `head()` options. Keeps title/description/OG/Twitter tags in sync.
 */

export const SITE_NAME = "movieCC";
export const DEFAULT_OG_IMAGE = "/og-default.jpg";

export type PageMetaInput = {
  title: string;
  description: string;
  /** Path or absolute URL, used for og:url + canonical. */
  url?: string;
  /** Absolute or relative image URL. Optional. */
  image?: string;
  /** og:type — "website" | "article" | "video.movie" | "video.episode". */
  type?: "website" | "article" | "video.movie" | "video.episode";
  /** true → adds noindex meta. */
  noindex?: boolean;
};

export type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

/** Truncate description to <=155 chars without splitting words. */
export function clampDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export function buildPageMeta(input: PageMetaInput): MetaTag[] {
  const description = clampDescription(input.description);
  const image = input.image;
  const type = input.type ?? "website";

  const meta: MetaTag[] = [
    { title: input.title },
    { name: "description", content: description },

    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: input.title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },

    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: description },
  ];

  if (input.url) {
    meta.push({ property: "og:url", content: input.url });
  }
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }
  if (input.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }
  return meta;
}
