/**
 * Schema Service - JSON-LD and FAQ generation for SEO
 *
 * Extracted from movieController.js for better maintainability.
 * Used by both SSR routes and API responses.
 */

/**
 * Builds JSON-LD schema for movie detail page
 */
function buildMovieJsonLd(movie, siteUrl) {
  const jsonLdType = movie.type === "series" || movie.type === "hoathinh" ? "TVSeries" : "Movie";
  const rawDesc = (movie.content || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 200);

  const jsonLdObj = {
    "@context": "https://schema.org",
    "@type": jsonLdType,
    name: movie.name || "",
    alternateName: movie.origin_name || "",
    description: rawDesc,
    image: movie.poster_url || movie.thumb_url || "",
    datePublished: movie.year ? String(movie.year) : "",
    dateModified: new Date().toISOString().split("T")[0],
    inLanguage: movie.lang || "vi",
    url: `${siteUrl}/phim/${movie.slug}`,
    genre: (movie.category || []).map((c) => c.name).filter(Boolean),
    contentRating: movie.quality || "HD",
  };

  if (movie.episode_total) jsonLdObj.numberOfEpisodes = movie.episode_total;

  if (movie.country?.length > 0) {
    jsonLdObj.countryOfOrigin = movie.country.map((c) => ({ "@type": "Country", name: c.name }));
  }

  const tmdbRating = movie.tmdb?.vote_average || 0;
  if (tmdbRating > 0) {
    jsonLdObj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: tmdbRating.toFixed(1),
      bestRating: "10",
      ratingCount: movie.tmdb?.vote_count || 1,
    };
  }

  if (movie.actor?.length > 0) {
    jsonLdObj.actor = movie.actor.slice(0, 5).map((a) => ({ "@type": "Person", name: a }));
  }

  if (movie.director?.length > 0) {
    jsonLdObj.director = movie.director.slice(0, 3).map((d) => ({ "@type": "Person", name: d }));
  }

  return JSON.stringify(jsonLdObj).replace(/<\//g, "<\\/");
}

/**
 * Builds FAQ JSON-LD for movie detail page
 */
function buildMovieFaqJsonLd(movie) {
  const faqData = [];
  const isSeries = movie.type === "series" || movie.type === "hoathinh";
  const epCount = movie.episode_total || "?";

  if (isSeries) {
    faqData.push({
      q: `${movie.name} có bao nhiêu tập?`,
      a: `${movie.name} có tổng cộng ${epCount} tập. Được cập nhật đều đặn trên movieCC với chất lượng ${movie.quality} và phụ đề tiếng Việt (${movie.lang}).`,
    });
  }

  if (movie.quality) {
    faqData.push({
      q: `${movie.name} có chất lượng nào?`,
      a: `${movie.name} có sẵn với chất lượng ${movie.quality}${movie.lang ? ` và phụ đề tiếng Việt (${movie.lang})` : ""}. Xem online không quảng cáo trên movieCC.`,
    });
  }

  if (movie.year) {
    faqData.push({
      q: `${movie.name} công chiếu năm nào?`,
      a: `${movie.name} công chiếu vào năm ${movie.year}${movie.country?.length ? `, thuộc phim ${movie.country.map((c) => c.name).join(", ")}` : ""}.`,
    });
  }

  if (movie.actor?.length > 0) {
    faqData.push({
      q: `Diễn viên trong ${movie.name} gồm những ai?`,
      a: `${movie.name} có sự tham gia của ${movie.actor.slice(0, 3).join(", ")}${movie.actor.length > 3 ? " và các diễn viên khác" : ""}.`,
    });
  }

  if (isSeries) {
    faqData.push({
      q: `Xem ${movie.name} ở đâu chất lượng cao?`,
      a: `Xem phim ${movie.name} chất lượng cao không quảng cáo tại movieCC. Cập nhật nhanh chóng với phụ đề tiếng Việt Vietsub.`,
    });
  }

  faqData.push({
    q: `${movie.name} - Xem phim online miễn phí?`,
    a: `Xem phim ${movie.name} trực tuyến miễn phí chất lượng cao tại movieCC. Kho phim đa dạng: phim bộ, phim lẻ, anime với phụ đề tiếng Việt.`,
  });

  if (faqData.length === 0) return "";

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }).replace(/<\//g, "<\\/");
}

/**
 * Builds Collection JSON-LD schema for category/browse pages
 */
function buildCollectionSchema(name, url, movies, siteUrl) {
  if (!movies || movies.length === 0) return "";

  const obj = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${name} - movieCC`,
    url: `${siteUrl}${url}`,
    description: `Danh sách phim ${name} mới nhất tại movieCC. Xem phim ${name} chất lượng cao, phụ đề tiếng Việt.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: movies.length,
      itemListElement: movies.slice(0, 12).map((m, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${siteUrl}/phim/${m.slug}`,
        name: (m.name || "").replace(/"/g, '\\"'),
      })),
    },
  };

  return JSON.stringify(obj).replace(/<\//g, "<\\/");
}

/**
 * Builds VideoObject JSON-LD for watch page
 */
function buildWatchJsonLd(movie, currentEpSlug, siteUrl, parseIsoDuration) {
  const displayEpName = currentEpSlug || "";
  const displayEpPrefix = displayEpName.toLowerCase() === "full" ? "Full" : `Tập ${displayEpName}`;

  const watchJsonLdObj = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${movie.name} - ${displayEpPrefix}`,
    description: `Xem phim ${movie.name} - ${displayEpPrefix} - ${movie.quality} ${movie.lang}. Xem trực tuyến tốc độ cao, phụ đề tiếng Việt.`,
    thumbnailUrl: movie.poster_url || movie.thumb_url || "",
    uploadDate: movie.year ? `${movie.year}-01-01` : new Date().toISOString().split("T")[0],
    contentUrl: `${siteUrl}/xem/${movie.slug}/${currentEpSlug}`,
    embedUrl: `${siteUrl}/xem/${movie.slug}/${currentEpSlug}`,
    inLanguage: movie.lang || "vi",
  };

  const isoDuration = parseIsoDuration(movie.time);
  if (isoDuration) watchJsonLdObj.duration = isoDuration;

  if (movie.category?.length > 0) {
    watchJsonLdObj.genre = movie.category.map((c) => c.name);
  }

  const watchTmdb = movie.tmdb?.vote_average || 0;
  if (watchTmdb > 0) {
    watchJsonLdObj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: watchTmdb.toFixed(1),
      bestRating: "10",
      ratingCount: movie.tmdb?.vote_count || 1,
    };
  }

  return JSON.stringify(watchJsonLdObj).replace(/<\//g, "<\\/");
}

module.exports = {
  buildMovieJsonLd,
  buildMovieFaqJsonLd,
  buildCollectionSchema,
  buildWatchJsonLd,
};
