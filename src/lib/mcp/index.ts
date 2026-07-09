import { defineMcp } from "@lovable.dev/mcp-js";
import searchMovies from "./tools/search-movies";
import browseCatalog from "./tools/browse-catalog";
import getMovie from "./tools/get-movie";
import trending from "./tools/trending";
import newReleases from "./tools/new-releases";

export default defineMcp({
  name: "moviecc-mcp",
  title: "MovieCC Catalog",
  version: "0.1.0",
  instructions:
    "Public read-only tools for the MovieCC movie catalog. Use `search_movies` for title/filter queries, `browse_catalog` to page through everything, `get_movie` for full details by slug, and `trending` / `new_releases` for curated lists. No authentication is required; no user-specific data is exposed.",
  tools: [searchMovies, browseCatalog, getMovie, trending, newReleases],
});
