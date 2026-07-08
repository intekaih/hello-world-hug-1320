import { createFileRoute } from "@tanstack/react-router";

export type BrowseMovie = {
  id: number;
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
  type: "phim-bo" | "phim-le" | "hoat-hinh" | "tv-shows";
};

const IMG = (p: string) => `https://image.tmdb.org/t/p/w500${p}`;

const CATEGORIES = [
  "Hành động", "Phiêu lưu", "Chính kịch", "Kinh dị", "Hài", "Tình cảm",
  "Khoa học viễn tưởng", "Bí ẩn", "Tội phạm", "Lịch sử",
];
const COUNTRIES = ["Mỹ", "Anh", "Hàn Quốc", "Nhật Bản", "Trung Quốc", "Việt Nam", "Pháp", "Tây Ban Nha"];

const RAW = [
  { title: "Dune: Part Two", origin: "Dune: Part Two", poster: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg", year: 2024, type: "phim-le", cats: ["Khoa học viễn tưởng", "Phiêu lưu"], countries: ["Mỹ"] },
  { title: "Oppenheimer", origin: "Oppenheimer", poster: "/fB4M9fjPr9HkfCZFEE7lqNoxDgU.png", year: 2023, type: "phim-le", cats: ["Chính kịch", "Lịch sử"], countries: ["Mỹ"] },
  { title: "The Batman", origin: "The Batman", poster: "/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg", year: 2022, type: "phim-le", cats: ["Tội phạm", "Bí ẩn"], countries: ["Mỹ"] },
  { title: "Interstellar", origin: "Interstellar", poster: "/pbrkL804c8yAv3zBZR4QPEafpAR.jpg", year: 2014, type: "phim-le", cats: ["Khoa học viễn tưởng", "Chính kịch"], countries: ["Mỹ"] },
  { title: "Everything Everywhere", origin: "EEAAO", poster: "/nGxUxi3PfXDRm7Vg95VBNgNM8yc.jpg", year: 2022, type: "phim-le", cats: ["Hành động", "Hài"], countries: ["Mỹ"] },
  { title: "Deadpool & Wolverine", origin: "Deadpool & Wolverine", poster: "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg", year: 2024, type: "phim-le", cats: ["Hành động", "Hài"], countries: ["Mỹ"] },
  { title: "Inside Out 2", origin: "Inside Out 2", poster: "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg", year: 2024, type: "hoat-hinh", cats: ["Hoạt hình", "Hài"], countries: ["Mỹ"] },
  { title: "Twisters", origin: "Twisters", poster: "/pjnD08FlMAIXsfOLKQbvmO0f0MD.jpg", year: 2024, type: "phim-le", cats: ["Hành động", "Phiêu lưu"], countries: ["Mỹ"] },
  { title: "Furiosa", origin: "Furiosa", poster: "/iADOJ8Zymht2JPMoy3R7xceZprc.jpg", year: 2024, type: "phim-le", cats: ["Hành động"], countries: ["Mỹ"] },
  { title: "Civil War", origin: "Civil War", poster: "/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg", year: 2024, type: "phim-le", cats: ["Hành động", "Chính kịch"], countries: ["Mỹ"] },
  { title: "Challengers", origin: "Challengers", poster: "/H6j5smdpRqP9a8UnhWp6zfl0SC.jpg", year: 2024, type: "phim-le", cats: ["Chính kịch", "Tình cảm"], countries: ["Mỹ"] },
  { title: "Shogun", origin: "Shōgun", poster: "/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg", year: 2024, type: "phim-bo", cats: ["Chính kịch", "Lịch sử"], countries: ["Mỹ", "Nhật Bản"] },
  { title: "The Bear", origin: "The Bear", poster: "/zPyHtXA8NLdrGDsPvBhI0pZfM63.jpg", year: 2023, type: "phim-bo", cats: ["Chính kịch", "Hài"], countries: ["Mỹ"] },
  { title: "House of the Dragon", origin: "House of the Dragon", poster: "/z2yahl2uefxDCl0nogcRBstwruJ.jpg", year: 2024, type: "phim-bo", cats: ["Phiêu lưu", "Chính kịch"], countries: ["Mỹ"] },
  { title: "Fallout", origin: "Fallout", poster: "/AnsSKmcvZuJRB6tIF3TrmYuwLwT.jpg", year: 2024, type: "phim-bo", cats: ["Khoa học viễn tưởng"], countries: ["Mỹ"] },
  { title: "3 Body Problem", origin: "3 Body Problem", poster: "/yzD9Kf4vjSy5cJefz25f7Y4B9tt.jpg", year: 2024, type: "phim-bo", cats: ["Khoa học viễn tưởng", "Bí ẩn"], countries: ["Mỹ"] },
  { title: "True Detective", origin: "True Detective", poster: "/nY1Y1PSycpQVpoRvSjJqCnrOl4W.jpg", year: 2024, type: "phim-bo", cats: ["Tội phạm", "Bí ẩn"], countries: ["Mỹ"] },
  { title: "The Last of Us", origin: "The Last of Us", poster: "/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg", year: 2023, type: "phim-bo", cats: ["Chính kịch", "Kinh dị"], countries: ["Mỹ"] },
  { title: "Succession", origin: "Succession", poster: "/7HW47XbkNQ5fiwQFYGWdw9gs1Vx.jpg", year: 2023, type: "phim-bo", cats: ["Chính kịch"], countries: ["Mỹ"] },
  { title: "Andor", origin: "Andor", poster: "/rjWaeeREF3vjNhwPHwWEyO27kMR.jpg", year: 2022, type: "phim-bo", cats: ["Khoa học viễn tưởng"], countries: ["Mỹ"] },
  { title: "The Boys", origin: "The Boys", poster: "/mY7SeH4HFFxW1hiI6cWuwCRKptN.jpg", year: 2024, type: "phim-bo", cats: ["Hành động"], countries: ["Mỹ"] },
  { title: "Squid Game", origin: "Squid Game", poster: "/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", year: 2021, type: "phim-bo", cats: ["Chính kịch", "Bí ẩn"], countries: ["Hàn Quốc"] },
  { title: "Wednesday", origin: "Wednesday", poster: "/9PFonBhy4cQy7Jz20NpMygczOkv.jpg", year: 2022, type: "phim-bo", cats: ["Bí ẩn", "Hài"], countries: ["Mỹ"] },
  { title: "Stranger Things", origin: "Stranger Things", poster: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg", year: 2022, type: "phim-bo", cats: ["Khoa học viễn tưởng"], countries: ["Mỹ"] },
  { title: "Peaky Blinders", origin: "Peaky Blinders", poster: "/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg", year: 2019, type: "phim-bo", cats: ["Tội phạm", "Chính kịch"], countries: ["Anh"] },
  { title: "Money Heist", origin: "La casa de papel", poster: "/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg", year: 2021, type: "phim-bo", cats: ["Tội phạm"], countries: ["Tây Ban Nha"] },
  { title: "Breaking Bad", origin: "Breaking Bad", poster: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", year: 2013, type: "phim-bo", cats: ["Tội phạm", "Chính kịch"], countries: ["Mỹ"] },
  { title: "Jujutsu Kaisen", origin: "呪術廻戦", poster: "/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg", year: 2023, type: "hoat-hinh", cats: ["Hành động"], countries: ["Nhật Bản"] },
  { title: "Attack on Titan", origin: "進撃の巨人", poster: "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg", year: 2023, type: "hoat-hinh", cats: ["Hành động", "Chính kịch"], countries: ["Nhật Bản"] },
  { title: "Demon Slayer", origin: "鬼滅の刃", poster: "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg", year: 2023, type: "hoat-hinh", cats: ["Hành động"], countries: ["Nhật Bản"] },
  { title: "Chainsaw Man", origin: "チェンソーマン", poster: "/npdB6eFzizki0WaZ1OvKcJrWe97.jpg", year: 2022, type: "hoat-hinh", cats: ["Hành động", "Kinh dị"], countries: ["Nhật Bản"] },
  { title: "Spy x Family", origin: "Spy x Family", poster: "/1uzeE0lYCEK1O6yCcgqA9M7QeYc.jpg", year: 2022, type: "hoat-hinh", cats: ["Hành động", "Hài"], countries: ["Nhật Bản"] },
  { title: "One Piece", origin: "ワンピース", poster: "/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg", year: 1999, type: "hoat-hinh", cats: ["Phiêu lưu"], countries: ["Nhật Bản"] },
  { title: "Frieren", origin: "葬送のフリーレン", poster: "/dqZENchTd7lp5zht7BdlqM7RBhD.jpg", year: 2023, type: "hoat-hinh", cats: ["Phiêu lưu", "Chính kịch"], countries: ["Nhật Bản"] },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const POOL: BrowseMovie[] = RAW.map((r, i) => ({
  id: 1000 + i,
  slug: slugify(r.title),
  title: r.title,
  origin_name: r.origin,
  poster_url: IMG(r.poster),
  year: r.year,
  rating: 7 + (i % 30) / 10,
  quality: (["4K", "FHD", "HD"] as const)[i % 3],
  language: (["Vietsub", "Lồng tiếng", "Thuyết minh"] as const)[i % 3],
  category: r.cats,
  country: r.countries,
  type: r.type as BrowseMovie["type"],
}));

// Expand to simulate a larger catalog
const EXPANDED: BrowseMovie[] = Array.from({ length: 4 }).flatMap((_, k) =>
  POOL.map((m) => ({ ...m, id: m.id + k * 5000 })),
);

const PAGE_SIZE = 24;

export const Route = createFileRoute("/api/browse")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await new Promise((r) => setTimeout(r, 200));
        const url = new URL(request.url);
        const type = url.searchParams.get("type") ?? "";
        const category = url.searchParams.get("category") ?? "";
        const country = url.searchParams.get("country") ?? "";
        const year = url.searchParams.get("year") ?? "";
        const sort = url.searchParams.get("sort") ?? "newest";
        const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

        let items = EXPANDED.slice();
        // Type mapping
        if (type === "phim-bo" || type === "phim-le" || type === "hoat-hinh") {
          items = items.filter((m) => m.type === type);
        } else if (type === "phim-moi-cap-nhat") {
          items = items.slice().sort((a, b) => b.year - a.year);
        } else if (type) {
          // category or country slug
          const decoded = decodeURIComponent(type);
          items = items.filter(
            (m) =>
              m.category.some((c) => slugify(c) === type) ||
              m.country.some((c) => slugify(c) === type) ||
              m.category.includes(decoded) ||
              m.country.includes(decoded),
          );
        }
        if (category) items = items.filter((m) => m.category.some((c) => slugify(c) === category));
        if (country) items = items.filter((m) => m.country.some((c) => slugify(c) === country));
        if (year) items = items.filter((m) => String(m.year) === year);

        if (sort === "newest") items.sort((a, b) => b.year - a.year);
        else if (sort === "oldest") items.sort((a, b) => a.year - b.year);
        else if (sort === "rating") items.sort((a, b) => b.rating - a.rating);
        else if (sort === "az") items.sort((a, b) => a.title.localeCompare(b.title));

        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (page - 1) * PAGE_SIZE;
        const paged = items.slice(start, start + PAGE_SIZE);
        return Response.json({ items: paged, page, totalPages, total });
      },
    },
  },
});

export { POOL as browsePool, CATEGORIES, COUNTRIES, slugify };
