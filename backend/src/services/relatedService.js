/**
 * Related Service - Related movies and series parts finder
 *
 * Extracted from movieController.js for better maintainability.
 */

const { sourceManager } = require("../config/providers");
const { cache } = require("../core/cache");
const logger = require("../utils/logger");
const {
  extractSeriesBaseName,
  extractSeriesBaseNames,
  extractPartNumber,
  extractBaseName,
} = require("../utils/slugUtils");

const relatedCache = cache.related;
const partsCache = cache.parts;

/**
 * Finds related parts/seasons for a series movie
 * @param {object} movie - Movie object
 * @returns {Promise<Array>} Array of related parts with metadata
 */
async function findRelatedParts(movie) {
  const baseNameN = extractSeriesBaseName(movie.name);
  const baseNamesO = extractSeriesBaseNames(movie.origin_name);
  const baseNameO = baseNamesO[0] || "";

  if ((!baseNameN || baseNameN.length < 2) && (!baseNameO || baseNameO.length < 2)) {
    return [];
  }

  // Cache key includes slug to avoid conflicts between different movies with same base name
  const cacheKey = `parts:${movie.slug}:${baseNameN || baseNameO}`;
  const cached = partsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const q = baseNameN || baseNameO;
    const searchResult = await sourceManager.searchAll(q, 1, 20);
    const allItems = searchResult.items || [];

    const candidates = [];
    const seenSlugs = new Set();
    let hasCurrent = false;

    const nonSeasonPattern = /tóm tắt|tổng hợp|\brecap\b|\bsummary\b|\bova\b|\boad\b|\bnhật ký\b|\bdiaries\b|\bthe movie\b/i;

    for (const item of allItems) {
      if (seenSlugs.has(item.slug)) continue;

      if (!item.isCurrent && item.slug !== movie.slug) {
        const itemNameLower = (item.name || "").toLowerCase();
        const movieNameLower = (movie.name || "").toLowerCase();
        if (nonSeasonPattern.test(itemNameLower) && !nonSeasonPattern.test(movieNameLower)) continue;
      }

      const itemBaseN = extractSeriesBaseName(item.name);
      const itemBaseNamesO = extractSeriesBaseNames(item.origin_name);

      let isMatch = false;
      if (baseNameN && itemBaseN && itemBaseN === baseNameN) {
        isMatch = true;
      } else {
        const hasOriginOverlap = baseNamesO.some((bo) => itemBaseNamesO.includes(bo));
        if (hasOriginOverlap) {
          if (baseNameN && itemBaseN && baseNameN !== itemBaseN) {
            if (item.type && movie.type && item.type !== movie.type) isMatch = false;
            else isMatch = true;
          } else {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        seenSlugs.add(item.slug);
        const partNum = extractPartNumber(item.name, item.origin_name);
        if (item.slug === movie.slug) hasCurrent = true;
        candidates.push({
          item,
          extractedPart: partNum,
          year: item.year || 0,
          isCurrent: item.slug === movie.slug,
          hasExplicit: !!partNum,
        });
      }
    }

    if (!hasCurrent) {
      candidates.push({
        item: movie,
        extractedPart: extractPartNumber(movie.name, movie.origin_name),
        year: movie.year || 0,
        isCurrent: true,
        hasExplicit: !!extractPartNumber(movie.name, movie.origin_name),
      });
    }

    const currentYear = movie.year || 0;
    let finalCandidates = candidates.filter((c) => {
      if (c.isCurrent) return true;
      if (currentYear > 0 && c.year > 0 && Math.abs(c.year - currentYear) > 20) return false;
      return true;
    });

    const explicitCount = finalCandidates.filter((c) => c.hasExplicit || c.isCurrent).length;
    if (explicitCount >= 2) {
      finalCandidates = finalCandidates.filter((c) => c.hasExplicit || c.isCurrent);
    }

    finalCandidates.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (!a.extractedPart && b.extractedPart) return -1;
      if (a.extractedPart && !b.extractedPart) return 1;
      if (a.extractedPart && b.extractedPart) return a.extractedPart - b.extractedPart;
      return 0;
    });

    const partsMap = new Map();
    const slugInMap = new Set();
    let nextPart = 1;

    for (const cand of finalCandidates) {
      if (slugInMap.has(cand.item.slug) && !cand.isCurrent) continue;

      let partNum = cand.extractedPart;
      if (!partNum) {
        partNum = nextPart;
      }
      if (partNum >= nextPart) nextPart = partNum + 1;

      const partObj = {
        name: `Phần ${partNum}`,
        fullName: `Phần ${partNum}${cand.year ? " (" + cand.year + ")" : ""}`,
        slug: cand.item.slug,
        part: partNum,
        year: cand.year,
        isCurrent: cand.isCurrent,
        _source: cand.item._source,
      };

      if (!partsMap.has(partNum)) {
        partsMap.set(partNum, partObj);
        slugInMap.add(cand.item.slug);
      } else {
        const existing = partsMap.get(partNum);
        if (existing.slug === cand.item.slug) {
          if (cand.isCurrent) partsMap.set(partNum, partObj);
        } else {
          if (cand.isCurrent) {
            const oldObj = partsMap.get(partNum);
            partsMap.set(partNum, partObj);
            slugInMap.add(cand.item.slug);
            const newSlot = nextPart++;
            oldObj.part = newSlot;
            oldObj.name = `Phần ${newSlot}`;
            oldObj.fullName = `Phần ${newSlot}${oldObj.year ? " (" + oldObj.year + ")" : ""}`;
            partsMap.set(newSlot, oldObj);
          } else if (cand.hasExplicit && !existing.hasExplicit) {
            const oldObj = partsMap.get(partNum);
            partsMap.set(partNum, partObj);
            slugInMap.add(cand.item.slug);
            const newSlot = nextPart++;
            oldObj.part = newSlot;
            oldObj.name = `Phần ${newSlot}`;
            oldObj.fullName = `Phần ${newSlot}${oldObj.year ? " (" + oldObj.year + ")" : ""}`;
            partsMap.set(newSlot, oldObj);
          } else {
            const newSlot = nextPart++;
            partObj.part = newSlot;
            partObj.name = `Phần ${newSlot}`;
            partObj.fullName = `Phần ${newSlot}${cand.year ? " (" + cand.year + ")" : ""}`;
            partsMap.set(newSlot, partObj);
            slugInMap.add(cand.item.slug);
          }
        }
      }
    }

    const parts = Array.from(partsMap.values()).sort((a, b) => (a.part || 999) - (b.part || 999));
    const result = parts.length > 1 ? parts : [];
    partsCache.set(cacheKey, result);
    return result;
  } catch (err) {
    logger.warn("parts", `findRelatedParts failed: ${baseNameO || baseNameN}`, err);
    return [];
  }
}

/**
 * Gets smart related movies based on categories, countries, and base name
 * @param {object} movie - Movie object
 * @returns {Promise<Array>} Array of related movies
 */
async function getSmartRelated(movie) {
  const cacheKey = `related:${movie._source}:${movie.slug}`;
  const cached = relatedCache.get(cacheKey);
  if (cached && cached.length > 0) return cached;

  const movieCategories = (movie.category || []).map((c) => c.slug);
  const movieCountries = (movie.country || []).map((c) => c.slug);
  const baseName = extractBaseName(movie.origin_name) || extractBaseName(movie.name);

  logger.info("movie", `getSmartRelated: slug=${movie.slug}, baseName="${baseName}", cats=${movieCategories.join(",")}, countries=${movieCountries.join(",")}, type=${movie.type}`);

  const fetches = [];

  // 1. Search by base name (60 items)
  if (baseName && baseName.length >= 2) {
    fetches.push(
      sourceManager.searchAll(baseName, 1, 60).catch(() => ({ items: [] }))
    );
  }

  // 2. Fetch by each category (top 3)
  for (const cat of movieCategories.slice(0, 3)) {
    fetches.push(
      sourceManager.getByCategory(cat, 1).catch(() => ({ items: [] }))
    );
  }

  // 3. Fetch by movie type
  const typeSlug =
    movie.type === "series" ? "phim-bo"
    : movie.type === "hoathinh" ? "hoat-hinh"
    : movie.type === "tvshows" ? "tv-shows"
    : null;
  if (typeSlug) {
    fetches.push(
      sourceManager.getByType(typeSlug, 1).catch(() => ({ items: [] }))
    );
  }

  // 4. Fetch by country (top 2)
  for (const country of movieCountries.slice(0, 2)) {
    fetches.push(
      sourceManager.getByCountry(country, 1).catch(() => ({ items: [] }))
    );
  }

  // 5. Also fetch "new movies" as a broad pool
  fetches.push(
    sourceManager.fetchAllNewMovies(1).catch(() => ({ items: [] }))
  );

  const results = await Promise.all(fetches);

  const candidateMap = new Map();
  for (const result of results) {
    for (const item of result.items || []) {
      if (item.slug === movie.slug) continue;
      if (!candidateMap.has(item.slug)) candidateMap.set(item.slug, item);
    }
  }

  logger.info("movie", `getSmartRelated: candidates=${candidateMap.size}, fetches=${results.length}, itemsPerFetch=[${results.map((r) => (r.items || []).length).join(",")}]`);

  const scored = [];
  for (const [, item] of candidateMap) {
    let score = 0;
    const itemBaseName = extractBaseName(item.origin_name) || extractBaseName(item.name);
    const baseL = baseName ? baseName.toLowerCase() : "";
    const itemBaseL = itemBaseName ? itemBaseName.toLowerCase() : "";
    if (baseL && itemBaseL) {
      if (baseL === itemBaseL) score += 50;
      else if (itemBaseL.startsWith(baseL) || baseL.startsWith(itemBaseL)) score += 40;
      else if (itemBaseL.includes(baseL) || baseL.includes(itemBaseL)) score += 20;
    }
    const itemCategories = (item.category || []).map((c) => c.slug);
    score += itemCategories.filter((c) => movieCategories.includes(c)).length * 10;
    const itemCountries = (item.country || []).map((c) => c.slug);
    score += itemCountries.filter((c) => movieCountries.includes(c)).length * 5;
    if (movie.year && item.year && Math.abs(movie.year - item.year) <= 3) score += 3;
    if (movie.type && item.type === movie.type) score += 2;
    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, 12).map((s) => s.item);
  logger.info("movie", `getSmartRelated: final result count=${result.length}, top3=[${result.slice(0, 3).map((m) => m.name).join(", ")}]`);
  relatedCache.set(cacheKey, result);
  return result;
}

/**
 * Clears related content cache
 * @param {string} slug - Movie slug (optional)
 */
function clearRelatedCache(slug) {
  if (slug) {
    relatedCache.del(`related::${slug}`);
    partsCache.del(`parts:${slug}:*`);
  } else {
    relatedCache.flushAll();
    partsCache.flushAll();
  }
}

module.exports = {
  findRelatedParts,
  getSmartRelated,
  clearRelatedCache,
};
