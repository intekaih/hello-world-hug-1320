import { createFileRoute } from "@tanstack/react-router";

const IMG = (path: string, size = "original") =>
  `https://image.tmdb.org/t/p/${size}${path}`;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const heroMovies = [
  {
    id: 1,
    title: "Dune: Part Two",
    overview:
      "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    backdrop_url: IMG("/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg"),
    logo_url: IMG("/8XzEC7QwZjSVxKrCE4l0GdvBiPl.png", "w500"),
    year: 2024,
    runtime: "2h 46m",
    rating: "PG-13",
    genres: ["Sci-Fi", "Adventure"],
  },
  {
    id: 2,
    title: "Oppenheimer",
    overview:
      "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    backdrop_url: IMG("/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg"),
    logo_url: IMG("/fB4M9fjPr9HkfCZFEE7lqNoxDgU.png", "w500"),
    year: 2023,
    runtime: "3h 0m",
    rating: "R",
    genres: ["Drama", "History"],
  },
  {
    id: 3,
    title: "The Batman",
    overview:
      "When a killer targets Gotham's elite with a series of sadistic machinations, Batman must forge new relationships.",
    backdrop_url: IMG("/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg"),
    logo_url: IMG("/qqHQsStV6exghCM7zbObuYBiYxw.png", "w500"),
    year: 2022,
    runtime: "2h 56m",
    rating: "PG-13",
    genres: ["Crime", "Mystery"],
  },
  {
    id: 4,
    title: "Interstellar",
    overview:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    backdrop_url: IMG("/pbrkL804c8yAv3zBZR4QPEafpAR.jpg"),
    logo_url: IMG("/bdN3gXuBRHsMFqLIhagPguRbdSF.png", "w500"),
    year: 2014,
    runtime: "2h 49m",
    rating: "PG-13",
    genres: ["Sci-Fi", "Drama"],
  },
  {
    id: 5,
    title: "Everything Everywhere All at Once",
    overview:
      "A middle-aged Chinese immigrant is swept up into an insane adventure in which she alone can save existence.",
    backdrop_url: IMG("/nGxUxi3PfXDRm7Vg95VBNgNM8yc.jpg"),
    logo_url: IMG("/xLkQKX0kSTgTOTF0KfZTS9BbUmY.png", "w500"),
    year: 2022,
    runtime: "2h 19m",
    rating: "R",
    genres: ["Action", "Adventure"],
  },
].map((m) => ({ ...m, slug: slugify(m.title) }));

const makeCard = (
  id: number,
  title: string,
  poster: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  title,
  slug: slugify(title.replace(/\s·\s.+$/, "")),
  poster_url: IMG(poster, "w500"),
  year: 2024,
  rating: 8.2,
  ...extra,
});

const top10Movies = [
  makeCard(101, "Shogun", "/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg"),
  makeCard(102, "The Bear", "/zPyHtXA8NLdrGDsPvBhI0pZfM63.jpg"),
  makeCard(103, "House of the Dragon", "/z2yahl2uefxDCl0nogcRBstwruJ.jpg"),
  makeCard(104, "Fallout", "/AnsSKmcvZuJRB6tIF3TrmYuwLwT.jpg"),
  makeCard(105, "3 Body Problem", "/yzD9Kf4vjSy5cJefz25f7Y4B9tt.jpg"),
  makeCard(106, "True Detective", "/nY1Y1PSycpQVpoRvSjJqCnrOl4W.jpg"),
  makeCard(107, "The Last of Us", "/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg"),
  makeCard(108, "Succession", "/7HW47XbkNQ5fiwQFYGWdw9gs1Vx.jpg"),
  makeCard(109, "Andor", "/rjWaeeREF3vjNhwPHwWEyO27kMR.jpg"),
  makeCard(110, "The Boys", "/mY7SeH4HFFxW1hiI6cWuwCRKptN.jpg"),
];

const hotSeriesMovies = [
  makeCard(201, "Squid Game", "/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg"),
  makeCard(202, "Wednesday", "/9PFonBhy4cQy7Jz20NpMygczOkv.jpg"),
  makeCard(203, "Stranger Things", "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg"),
  makeCard(204, "Peaky Blinders", "/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg"),
  makeCard(205, "Money Heist", "/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg"),
  makeCard(206, "Dark", "/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg"),
  makeCard(207, "Breaking Bad", "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg"),
];

const newMovies = [
  makeCard(301, "Deadpool & Wolverine", "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"),
  makeCard(302, "Inside Out 2", "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg"),
  makeCard(303, "Twisters", "/pjnD08FlMAIXsfOLKQbvmO0f0MD.jpg"),
  makeCard(304, "Furiosa", "/iADOJ8Zymht2JPMoy3R7xceZprc.jpg"),
  makeCard(305, "Kingdom of the Planet of the Apes", "/gKkl37BQuKTanygYQG1pyYgLVgf.jpg"),
  makeCard(306, "Civil War", "/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg"),
  makeCard(307, "Challengers", "/H6j5smdpRqP9a8UnhWp6zfl0SC.jpg"),
];

const animeMovies = [
  makeCard(401, "Jujutsu Kaisen", "/fHpKWq9ayzSk8nSwqRuaAUemRKh.jpg"),
  makeCard(402, "Attack on Titan", "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg"),
  makeCard(403, "Demon Slayer", "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg"),
  makeCard(404, "Chainsaw Man", "/npdB6eFzizki0WaZ1OvKcJrWe97.jpg"),
  makeCard(405, "Spy x Family", "/1uzeE0lYCEK1O6yCcgqA9M7QeYc.jpg"),
  makeCard(406, "One Piece", "/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg"),
  makeCard(407, "Frieren", "/dqZENchTd7lp5zht7BdlqM7RBhD.jpg"),
];

const continueWatching = [
  {
    ...makeCard(501, "Shogun · Ep 8", "/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg"),
    progress: 0.42,
    remaining: "38 min left",
  },
  {
    ...makeCard(502, "Dune: Part Two", "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg"),
    progress: 0.78,
    remaining: "36 min left",
  },
  {
    ...makeCard(503, "Fallout · Ep 3", "/AnsSKmcvZuJRB6tIF3TrmYuwLwT.jpg"),
    progress: 0.15,
    remaining: "52 min left",
  },
  {
    ...makeCard(504, "The Bear · Ep 5", "/zPyHtXA8NLdrGDsPvBhI0pZfM63.jpg"),
    progress: 0.9,
    remaining: "4 min left",
  },
];

export const Route = createFileRoute("/api/movies/home")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify({
            heroMovies,
            top10Movies,
            hotSeriesMovies,
            newMovies,
            animeMovies,
            continueWatching,
          }),
          {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=60",
            },
          },
        ),
    },
  },
});
