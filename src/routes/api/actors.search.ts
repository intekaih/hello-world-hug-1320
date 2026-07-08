import { createFileRoute } from "@tanstack/react-router";
import { browsePool, slugify } from "./browse";

// Deterministic actor catalog derived from the movie pool.
const ACTOR_NAMES = [
  "Timothée Chalamet", "Zendaya", "Cillian Murphy", "Robert Pattinson",
  "Matthew McConaughey", "Michelle Yeoh", "Ryan Reynolds", "Hugh Jackman",
  "Anya Taylor-Joy", "Kirsten Dunst", "Hiroyuki Sanada", "Anna Sawai",
  "Jeremy Allen White", "Matt Smith", "Emma D'Arcy", "Walton Goggins",
  "Jodie Foster", "Pedro Pascal", "Bella Ramsey", "Brian Cox",
  "Diego Luna", "Karl Urban", "Lee Jung-jae", "Jenna Ortega",
  "Millie Bobby Brown", "Cillian Murphy", "Álvaro Morte", "Bryan Cranston",
];

function actorSlug(name: string) {
  return slugify(name);
}

const AVATAR = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;

type Actor = {
  slug: string;
  name: string;
  avatar_url: string;
  known_for: string[];
  movies: typeof browsePool;
};

const ACTORS: Map<string, Actor> = new Map(
  ACTOR_NAMES.map((name, i) => {
    // Deterministic 5-8 movies per actor
    const count = 5 + (i % 4);
    const movies = Array.from({ length: count }).map(
      (_, k) => browsePool[(i * 3 + k * 5) % browsePool.length]!,
    );
    return [
      actorSlug(name),
      {
        slug: actorSlug(name),
        name,
        avatar_url: AVATAR(name),
        known_for: movies.slice(0, 3).map((m) => m.title),
        movies,
      },
    ];
  }),
);

export const Route = createFileRoute("/api/actors/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        const items = Array.from(ACTORS.values())
          .filter((a) => !q || a.name.toLowerCase().includes(q))
          .slice(0, 12)
          .map((a) => ({
            slug: a.slug,
            name: a.name,
            avatar_url: a.avatar_url,
            known_for: a.known_for,
          }));
        return Response.json({ items });
      },
    },
  },
});

export { ACTORS };
