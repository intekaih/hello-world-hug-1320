import { createFileRoute } from "@tanstack/react-router";

const IMG = (path: string, size = "original") =>
  `https://image.tmdb.org/t/p/${size}${path}`;

const MOVIES: Record<string, unknown> = {
  "dune-part-two": {
    slug: "dune-part-two",
    title: "Dune: Part Two",
    original_title: "Dune: Part Two",
    year: 2024,
    duration: "2h 46m",
    quality: "4K",
    language: "Vietsub",
    rating: 8.5,
    age_rating: "PG-13",
    backdrop_url: IMG("/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg"),
    poster_url: IMG("/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", "w500"),
    logo_url: IMG("/8XzEC7QwZjSVxKrCE4l0GdvBiPl.png", "w500"),
    trailer_url: "https://www.youtube.com/watch?v=Way9Dexny3w",
    overview:
      "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the known universe, he endeavors to prevent a terrible future only he can foresee.",
    overview_vi:
      "Paul Atreides hợp nhất với Chani và người Fremen để trả thù những kẻ đã hủy hoại gia đình mình. Đứng giữa tình yêu và số phận của cả vũ trụ, anh cố gắng ngăn chặn một tương lai khủng khiếp mà chỉ mình anh có thể thấy trước.",
    categories: ["Sci-Fi", "Adventure", "Drama"],
    country: "Mỹ",
    director: "Denis Villeneuve",
    cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson", "Javier Bardem"],
    total_episodes: 1,
    parts: [
      { slug: "dune-part-one", label: "Part 1", year: 2021 },
      { slug: "dune-part-two", label: "Part 2", year: 2024 },
    ],
  },
  shogun: {
    slug: "shogun",
    title: "Shogun",
    original_title: "将軍",
    year: 2024,
    duration: "1h/tập",
    quality: "HD",
    language: "Thuyết minh",
    rating: 9.1,
    age_rating: "TV-MA",
    backdrop_url: IMG("/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg"),
    poster_url: IMG("/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg", "w500"),
    logo_url: "",
    trailer_url: "https://www.youtube.com/watch?v=Qxu-3Ip5eIY",
    overview:
      "Set in Japan in the year 1600, at the dawn of a century-defining civil war. Lord Yoshii Toranaga is fighting for his life as his enemies on the Council of Regents unite against him.",
    overview_vi:
      "Bối cảnh Nhật Bản năm 1600, khi cuộc nội chiến định hình cả thế kỷ sắp nổ ra. Lãnh chúa Yoshii Toranaga phải đấu tranh giành sự sống khi các thành viên Hội đồng Nhiếp chính liên kết chống lại ông.",
    categories: ["Drama", "History", "Action"],
    country: "Mỹ",
    director: "Rachel Kondo, Justin Marks",
    cast: ["Hiroyuki Sanada", "Cosmo Jarvis", "Anna Sawai"],
    total_episodes: 10,
    parts: [],
  },
};

const RELATED = [
  {
    slug: "oppenheimer",
    title: "Oppenheimer",
    poster_url: IMG("/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", "w500"),
    year: 2023,
    rating: 8.4,
  },
  {
    slug: "the-batman",
    title: "The Batman",
    poster_url: IMG("/74xTEgt7R36Fpooo50r9T25onhq.jpg", "w500"),
    year: 2022,
    rating: 7.8,
  },
  {
    slug: "interstellar",
    title: "Interstellar",
    poster_url: IMG("/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", "w500"),
    year: 2014,
    rating: 8.6,
  },
  {
    slug: "blade-runner-2049",
    title: "Blade Runner 2049",
    poster_url: IMG("/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", "w500"),
    year: 2017,
    rating: 8.0,
  },
  {
    slug: "everything-everywhere",
    title: "Everything Everywhere",
    poster_url: IMG("/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg", "w500"),
    year: 2022,
    rating: 8.1,
  },
  {
    slug: "arrival",
    title: "Arrival",
    poster_url: IMG("/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg", "w500"),
    year: 2016,
    rating: 7.9,
  },
];

// Fallback: derive a minimal movie from POOL so any slug on the site works.
import { POOL } from "./suggest";
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

import { getCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/api/movies/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // 1) Hand-curated overrides win (rich TMDB metadata for hero titles).
        const curated = MOVIES[params.slug];
        if (curated) return Response.json(curated);

        // 2) Ask the active CatalogSource (KKPhim in prod, Mock in dev).
        const detail = await getCatalog().detail(params.slug);
        if (detail) {
          return Response.json({
            ...detail,
            original_title: detail.origin_name,
            categories: detail.category,
            country: detail.country.join(", "),
          });
        }

        // 3) Legacy suggest-pool fallback so any suggest slug still resolves.
        const p = POOL.find((m) => slugify(m.title) === params.slug);
        if (p) {
          return Response.json({
            slug: params.slug,
            title: p.title,
            original_title: p.title,
            year: p.year,
            duration: p.type === "Phim bộ" ? "45 phút/tập" : "1h 55m",
            quality: "HD",
            language: "Vietsub",
            rating: 7.5 + (p.id % 25) / 10,
            age_rating: "PG-13",
            backdrop_url: `https://image.tmdb.org/t/p/original${p.poster}`,
            poster_url: `https://image.tmdb.org/t/p/w500${p.poster}`,
            logo_url: "",
            trailer_url: "",
            overview: `${p.title} — nội dung phim đang được cập nhật.`,
            overview_vi: `${p.title} — nội dung phim đang được cập nhật.`,
            categories: [p.type],
            country: "US",
            director: "",
            cast: [],
            total_episodes: p.type === "Phim bộ" ? 10 : 1,
            parts: [],
          });
        }
        return new Response("Not found", { status: 404 });
      },
    },
  },
});

// Export for reuse
export { RELATED };
