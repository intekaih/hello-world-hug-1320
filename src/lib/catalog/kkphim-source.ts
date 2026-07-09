/**
 * KKPhimSource — CatalogSource adapter for phimapi.com (KKPhim public API).
 *
 * Endpoints used:
 *   GET /v1/api/tim-kiem?keyword=..&page=..&limit=..
 *   GET /v1/api/danh-sach/{type}?page=..&limit=..&sort_field=..&country=..&category=..&year=..
 *   GET /phim/{slug}                             → detail
 *   GET /danh-sach/phim-moi-cap-nhat-v3?page=1   → latest
 *
 * The adapter never throws for empty/errored upstream calls — returns empty
 * pages / null so callers can render gracefully. Base URL is read from
 * `KKPHIM_API_BASE` (server env), default https://phimapi.com.
 */
import type {
  BrowseParams,
  CatalogCard,
  CatalogDetail,
  CatalogSource,
  CatalogType,
  Paged,
  SearchParams,
} from "./source";

const DEFAULT_BASE = "https://phimapi.com";
const DEFAULT_PAGE_SIZE = 24;

function base(): string {
  const b = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.KKPHIM_API_BASE;
  return (b && b.replace(/\/$/, "")) || DEFAULT_BASE;
}

type RawItem = {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
  type?: string;
  category?: { name: string; slug: string }[];
  country?: { name: string; slug: string }[];
  tmdb?: { vote_average?: number };
};

function absUrl(u?: string): string {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  return `https://phimimg.com/${u.replace(/^\/+/, "")}`;
}

function mapType(t?: string): CatalogType {
  if (t === "series") return "phim-bo";
  if (t === "single") return "phim-le";
  if (t === "hoathinh") return "hoat-hinh";
  if (t === "tvshows") return "tv-shows";
  return "phim-le";
}

function mapQuality(q?: string): CatalogCard["quality"] {
  const s = (q ?? "").toUpperCase();
  if (s.includes("4K")) return "4K";
  if (s.includes("FHD") || s.includes("FULL")) return "FHD";
  return "HD";
}

function mapLang(l?: string): CatalogCard["language"] {
  const s = (l ?? "").toLowerCase();
  if (s.includes("lồng") || s.includes("long tieng")) return "Lồng tiếng";
  if (s.includes("thuyết") || s.includes("thuyet")) return "Thuyết minh";
  return "Vietsub";
}

function itemToCard(r: RawItem, fallbackId = 0): CatalogCard {
  return {
    id: r._id ?? fallbackId,
    slug: r.slug ?? "",
    title: r.name ?? "",
    origin_name: r.origin_name ?? r.name ?? "",
    poster_url: absUrl(r.poster_url || r.thumb_url),
    year: Number(r.year) || 0,
    rating: Number(r.tmdb?.vote_average) || 7.5,
    quality: mapQuality(r.quality),
    language: mapLang(r.lang),
    category: (r.category ?? []).map((c) => c.name),
    country: (r.country ?? []).map((c) => c.name),
    type: mapType(r.type),
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type ListResponse = {
  status?: boolean | string;
  data?: {
    items?: RawItem[];
    params?: {
      pagination?: {
        totalItems?: number;
        totalItemsPerPage?: number;
        currentPage?: number;
        totalPages?: number;
      };
    };
  };
  items?: RawItem[];
  pagination?: {
    totalItems?: number;
    totalPages?: number;
    currentPage?: number;
  };
};

function unwrapList(json: ListResponse | null, page: number, pageSize: number): Paged<CatalogCard> {
  if (!json) return { items: [], page, totalPages: 0, total: 0 };
  const items = (json.data?.items ?? json.items ?? []).map((r, i) => itemToCard(r, i));
  const pag = json.data?.params?.pagination ?? json.pagination ?? {};
  return {
    items,
    page: pag.currentPage ?? page,
    totalPages: pag.totalPages ?? Math.max(1, Math.ceil((pag.totalItems ?? items.length) / pageSize)),
    total: pag.totalItems ?? items.length,
  };
}

type DetailResponse = {
  status?: boolean | string;
  movie?: RawItem & {
    content?: string;
    time?: string;
    thumb_url?: string;
    trailer_url?: string;
    episode_total?: string | number;
    actor?: string[];
    director?: string[];
  };
  episodes?: {
    server_name?: string;
    server_data?: {
      slug?: string;
      name?: string;
      link_embed?: string;
      link_m3u8?: string;
    }[];
  }[];
};

export const KKPhimSource: CatalogSource = {
  id: "kkphim",

  async search(params) {
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const q = new URLSearchParams();
    if (params.q) q.set("keyword", params.q);
    q.set("page", String(Math.max(1, params.page ?? 1)));
    q.set("limit", String(pageSize));
    if (params.category) q.set("category", params.category);
    if (params.country) q.set("country", params.country);
    if (params.year) q.set("year", String(params.year));
    const json = await fetchJson<ListResponse>(`${base()}/v1/api/tim-kiem?${q}`);
    let paged = unwrapList(json, params.page ?? 1, pageSize);
    // client-side filters phimapi doesn't support
    if (params.type) paged.items = paged.items.filter((m) => m.type === params.type);
    if (params.quality) paged.items = paged.items.filter((m) => m.quality === params.quality);
    if (params.language) paged.items = paged.items.filter((m) => m.language === params.language);
    return paged;
  },

  async browse(params) {
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const type = params.type ?? "phim-le";
    const q = new URLSearchParams();
    q.set("page", String(Math.max(1, params.page ?? 1)));
    q.set("limit", String(pageSize));
    const sortField =
      params.sort === "rating"
        ? "tmdb.vote_average"
        : params.sort === "oldest"
          ? "year"
          : "modified.time";
    q.set("sort_field", sortField);
    q.set("sort_type", params.sort === "oldest" ? "asc" : "desc");
    if (params.category) q.set("category", params.category);
    if (params.country) q.set("country", params.country);
    if (params.year) q.set("year", String(params.year));
    const json = await fetchJson<ListResponse>(
      `${base()}/v1/api/danh-sach/${encodeURIComponent(type)}?${q}`,
    );
    const paged = unwrapList(json, params.page ?? 1, pageSize);
    if (params.sort === "az") {
      paged.items.sort((a, b) => a.title.localeCompare(b.title));
    }
    return paged;
  },

  async detail(slug) {
    const json = await fetchJson<DetailResponse>(`${base()}/phim/${encodeURIComponent(slug)}`);
    const m = json?.movie;
    if (!m || !m.slug) return null;
    const card = itemToCard(m as RawItem);
    const servers = (json?.episodes ?? []).map((s) => ({
      server_name: s.server_name ?? "Server",
      episodes: (s.server_data ?? []).map((e) => ({
        slug: e.slug ?? "",
        name: e.name ?? "",
        link_embed: e.link_embed,
        link_m3u8: e.link_m3u8,
      })),
    }));
    const totalEpisodes =
      Number(m.episode_total) ||
      servers[0]?.episodes.length ||
      (card.type === "phim-le" ? 1 : 0);
    const detail: CatalogDetail = {
      ...card,
      backdrop_url: absUrl(m.thumb_url) || card.poster_url,
      logo_url: "",
      trailer_url: m.trailer_url ?? "",
      overview: m.content ?? "",
      overview_vi: m.content ?? "",
      duration: m.time ?? (card.type === "phim-le" ? "1h 55m" : "45 phút/tập"),
      age_rating: "PG-13",
      director: (m.director ?? []).filter(Boolean).join(", "),
      cast: (m.actor ?? []).filter(Boolean),
      total_episodes: totalEpisodes,
      parts: [],
      servers,
    };
    return detail;
  },

  async trending(limit = 18) {
    const paged = await this.browse({
      type: "phim-le",
      sort: "rating",
      page: 1,
      pageSize: Math.max(1, limit),
    });
    return paged.items.slice(0, limit);
  },

  async newReleases(limit = 20, type) {
    const paged = await this.browse({
      type: type ?? "phim-le",
      sort: "newest",
      page: 1,
      pageSize: Math.max(1, limit),
    });
    return paged.items.slice(0, limit);
  },
};
