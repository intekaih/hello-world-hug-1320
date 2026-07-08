import { createFileRoute } from "@tanstack/react-router";

const IMG = (path: string, size = "w500") =>
  `https://image.tmdb.org/t/p/${size}${path}`;

const POOL = [
  { id: 1, title: "Dune: Part Two", year: 2024, poster: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg", type: "Phim lẻ" },
  { id: 2, title: "Oppenheimer", year: 2023, poster: "/fB4M9fjPr9HkfCZFEE7lqNoxDgU.png", type: "Phim lẻ" },
  { id: 3, title: "The Batman", year: 2022, poster: "/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg", type: "Phim lẻ" },
  { id: 4, title: "Interstellar", year: 2014, poster: "/pbrkL804c8yAv3zBZR4QPEafpAR.jpg", type: "Phim lẻ" },
  { id: 5, title: "Everything Everywhere All at Once", year: 2022, poster: "/nGxUxi3PfXDRm7Vg95VBNgNM8yc.jpg", type: "Phim lẻ" },
  { id: 6, title: "Shogun", year: 2024, poster: "/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg", type: "Phim bộ" },
  { id: 7, title: "The Bear", year: 2023, poster: "/zPyHtXA8NLdrGDsPvBhI0pZfM63.jpg", type: "Phim bộ" },
  { id: 8, title: "House of the Dragon", year: 2024, poster: "/z2yahl2uefxDCl0nogcRBstwruJ.jpg", type: "Phim bộ" },
  { id: 9, title: "Fallout", year: 2024, poster: "/AnsSKmcvZuJRB6tIF3TrmYuwLwT.jpg", type: "Phim bộ" },
  { id: 10, title: "3 Body Problem", year: 2024, poster: "/yzD9Kf4vjSy5cJefz25f7Y4B9tt.jpg", type: "Phim bộ" },
  { id: 11, title: "The Last of Us", year: 2023, poster: "/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg", type: "Phim bộ" },
  { id: 12, title: "Squid Game", year: 2021, poster: "/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", type: "Phim bộ" },
  { id: 13, title: "Wednesday", year: 2022, poster: "/9PFonBhy4cQy7Jz20NpMygczOkv.jpg", type: "Phim bộ" },
  { id: 14, title: "Stranger Things", year: 2022, poster: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg", type: "Phim bộ" },
  { id: 15, title: "Peaky Blinders", year: 2019, poster: "/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg", type: "Phim bộ" },
  { id: 16, title: "Money Heist", year: 2021, poster: "/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg", type: "Phim bộ" },
  { id: 17, title: "Breaking Bad", year: 2013, poster: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", type: "Phim bộ" },
  { id: 18, title: "Deadpool & Wolverine", year: 2024, poster: "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg", type: "Phim lẻ" },
  { id: 19, title: "Inside Out 2", year: 2024, poster: "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg", type: "Phim lẻ" },
  { id: 20, title: "Twisters", year: 2024, poster: "/pjnD08FlMAIXsfOLKQbvmO0f0MD.jpg", type: "Phim lẻ" },
  { id: 21, title: "Furiosa", year: 2024, poster: "/iADOJ8Zymht2JPMoy3R7xceZprc.jpg", type: "Phim lẻ" },
  { id: 22, title: "Civil War", year: 2024, poster: "/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg", type: "Phim lẻ" },
  { id: 23, title: "Challengers", year: 2024, poster: "/H6j5smdpRqP9a8UnhWp6zfl0SC.jpg", type: "Phim lẻ" },
  { id: 24, title: "Jujutsu Kaisen", year: 2023, poster: "/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg", type: "Anime" },
  { id: 25, title: "Attack on Titan", year: 2023, poster: "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg", type: "Anime" },
  { id: 26, title: "Demon Slayer", year: 2023, poster: "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg", type: "Anime" },
  { id: 27, title: "Chainsaw Man", year: 2022, poster: "/npdB6eFzizki0WaZ1OvKcJrWe97.jpg", type: "Anime" },
  { id: 28, title: "Spy x Family", year: 2022, poster: "/1uzeE0lYCEK1O6yCcgqA9M7QeYc.jpg", type: "Anime" },
  { id: 29, title: "One Piece", year: 1999, poster: "/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg", type: "Anime" },
  { id: 30, title: "Frieren", year: 2023, poster: "/dqZENchTd7lp5zht7BdlqM7RBhD.jpg", type: "Anime" },
];

export const Route = createFileRoute("/api/suggest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        if (!q) return Response.json({ items: [] });
        const items = POOL.filter((m) => m.title.toLowerCase().includes(q))
          .slice(0, 8)
          .map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            type: m.type,
            poster_url: IMG(m.poster),
            slug: m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          }));
        return Response.json({ items });
      },
    },
  },
});

export { POOL };
