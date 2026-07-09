/**
 * Mock home data — fallback when BE (Express) is unreachable.
 * Keeps the app usable in dev, preview, and demo mode.
 */
import type { HomeData, HeroMovie, MovieCard } from "./home-queries";

const POSTER = (seed: string, w = 500, h = 750) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

const hero = (i: number, title: string, overview: string): HeroMovie => ({
  id: 9000 + i,
  slug: `mock-hero-${i}`,
  title,
  overview,
  backdrop_url: POSTER(`mccbd${i}`, 1920, 1080),
  logo_url: "",
  year: 2024,
  runtime: "120 phút",
  rating: "9.0",
  genres: ["Hành động", "Phiêu lưu"],
  trailer_url: null,
});

const card = (i: number, title: string, tag = "mccp", kind: "series" | "single" | "anime" = "single"): MovieCard => {
  const qualities = ["4K", "FHD", "HD", "FHD"];
  const isSeries = kind !== "single";
  return {
    id: 1000 + i,
    slug: `mock-${tag}-${i}`,
    title,
    poster_url: POSTER(`${tag}${i}`),
    year: 2020 + (i % 5),
    rating: Number((7 + (i % 30) / 10).toFixed(1)),
    quality: qualities[i % qualities.length],
    kind,
    episodeLabel: isSeries
      ? (i % 4 === 0 ? "Full" : `Tập ${(i % 12) + 1}/${(i % 12) + 4}`)
      : undefined,
  };
};

const seed = (prefix: string, count: number, kind: "series" | "single" | "anime" = "single") =>
  Array.from({ length: count }, (_, i) =>
    card(i, `${prefix} ${i + 1}`, prefix.toLowerCase().replace(/\s/g, ""), kind),
  );

export const MOCK_HOME_DATA: HomeData = {
  heroMovies: [
    hero(1, "Vũ Trụ Bất Tận", "Hành trình xuyên không gian giành lại quê hương đã mất."),
    hero(2, "Bí Mật Kinh Đô", "Một điệp viên trẻ lần theo dấu vết cuối cùng của cha."),
    hero(3, "Đêm Không Ngủ", "Thành phố về đêm — nơi mọi bí mật đều có giá."),
  ],
  top10Movies: seed("Top", 10, "single"),
  hotSeriesMovies: seed("Bộ", 12, "series"),
  newMovies: seed("Mới", 12, "single"),
  animeMovies: seed("Anime", 12, "anime"),
  continueWatching: [],
};
