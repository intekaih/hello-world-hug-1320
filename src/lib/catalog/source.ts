/**
 * CatalogSource — single interface for all movie data reads (search, browse,
 * detail, trending). Concrete implementations: MockSource (in-repo pool),
 * KKPhimSource (phimapi.com adapter). Everything downstream — TSS API routes,
 * MCP tools, home queries — reads through this so mock ↔ real can swap
 * without touching callers.
 */

export type CatalogType = "phim-bo" | "phim-le" | "hoat-hinh" | "tv-shows";

export type CatalogCard = {
  id: number | string;
  slug: string;
  title: string;
  origin_name: string;
  poster_url: string;
  year: number;
  rating: number;
  quality: "4K" | "FHD" | "HD";
  language: "Vietsub" | "Lồng tiếng" | "Thuyết minh";
  category: string[];
  country: string[];
  type: CatalogType;
};

export type CatalogEpisode = {
  slug: string;
  name: string;
  link_embed?: string;
  link_m3u8?: string;
};

export type CatalogServer = {
  server_name: string;
  episodes: CatalogEpisode[];
};

export type CatalogDetail = CatalogCard & {
  backdrop_url: string;
  logo_url: string;
  trailer_url: string;
  overview: string;
  overview_vi: string;
  duration: string;
  age_rating: string;
  director: string;
  cast: string[];
  total_episodes: number;
  parts: { slug: string; label: string; year: number }[];
  servers?: CatalogServer[];
};

export type Paged<T> = {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
};

export type SearchParams = {
  q?: string;
  type?: CatalogType;
  category?: string;
  country?: string;
  year?: number;
  quality?: CatalogCard["quality"];
  language?: CatalogCard["language"];
  page?: number;
  pageSize?: number;
};

export type BrowseParams = Omit<SearchParams, "q"> & {
  sort?: "newest" | "oldest" | "rating" | "az";
};

export interface CatalogSource {
  readonly id: string;
  search(params: SearchParams): Promise<Paged<CatalogCard>>;
  browse(params: BrowseParams): Promise<Paged<CatalogCard>>;
  detail(slug: string): Promise<CatalogDetail | null>;
  trending(limit?: number): Promise<CatalogCard[]>;
  newReleases(limit?: number, type?: CatalogType): Promise<CatalogCard[]>;
}
