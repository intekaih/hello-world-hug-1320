/**
 * Slug Utilities - Episode slug parsing and series name extraction
 *
 * Extracted from movieController.js for better maintainability.
 * Used for episode formatting and series/movie relationship detection.
 */

// ─── Episode slug parsing ──────────────────────────────────────────────────────

/**
 * Extracts episode number from episode_current string
 * e.g. "Tập 12" → "12", "Tập 1" → "1", "Full" → "full"
 */
function epSlugFromCurrent(ep) {
  if (!ep) return null;
  const s = ep.toLowerCase().trim();
  if (s === "full" || s === "complete") return "full";
  const m = s.match(/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Formats episode slug to human-readable name
 */
function formatEpisodeSlug(slug) {
  if (!slug) return "";
  const s = slug.toLowerCase();
  if (s === "full" || s === "hoan-tat" || s === "hoantat") return "Bản Full";
  if (s.startsWith("tap-")) return `Tập ${s.replace("tap-", "")}`;
  if (!isNaN(Number(slug))) return `Tập ${slug}`;
  return slug;
}

// ─── Series base name extraction ──────────────────────────────────────────────

/**
 * Extracts base series name (removes season/part numbers)
 */
function extractSeriesBaseName(name) {
  if (!name) return "";
  let base = name
    .replace(/\(\s*(phần|phàn|season|ss|part|mùa)\s*\d+\s*\)/gi, "")
    .replace(/\b(phần|phàn|season|ss|part|mùa)\s*\d+/gi, "")
    .replace(/\b\d+(st|nd|rd|th)\s+(season|part)\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\(\s*\d{4}\s*\)/g, "");
  const parts = base.split(/[:\-–\(]/);
  base = parts[0];
  base = base.replace(/\s+\d+\s*$/, "");
  base = base.replace(/\s+(?:II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\s*$/i, "");
  base = base.replace(/[,\.\?!;]/g, "");
  return base.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Extracts multiple base names (for movies with multiple titles)
 */
function extractSeriesBaseNames(name) {
  if (!name) return [];
  const titles = name.split(/,\s*/);
  const results = new Set();
  for (const t of titles) {
    const b = extractSeriesBaseName(t.trim());
    if (b && b.length >= 2) results.add(b);
  }
  return [...results];
}

// Roman numeral to Arabic mapping
const ROMAN_MAP = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

/**
 * Extracts part/season number from movie name
 */
function extractPartNumber(name, origin_name) {
  const check = (str) => {
    if (!str) return null;
    const match = str.match(/(?:phần|phàn|season|ss|part|mùa)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
    const ordMatch = str.match(/(\d+)(?:st|nd|rd|th)\s+(?:season|part)/i);
    if (ordMatch) return parseInt(ordMatch[1], 10);
    const prefix = str.split(/[:\-–\(]/)[0].trim();
    const romanMatch = prefix.match(/\s+(I{1,3}|IV|VI{0,3}|IX|XI{0,2}|X{1,2}I{0,3})$/i);
    if (romanMatch) {
      const roman = romanMatch[1].toUpperCase();
      if (ROMAN_MAP[roman]) return ROMAN_MAP[roman];
    }
    const numMatch = prefix.match(/\s+(\d+)$/);
    if (numMatch) return parseInt(numMatch[1], 10);
    return null;
  };
  return check(name) || check(origin_name) || null;
}

/**
 * Extracts simple base name (removes all season/episode indicators)
 */
function extractBaseName(name) {
  if (!name) return "";
  return name
    .replace(/\s*(Phần|Season|Part|Mùa)\s*\d+/gi, "")
    .replace(/\s*\d+\s*$/, "")
    .replace(/\s*[:\-–]\s*$/, "")
    .trim();
}

module.exports = {
  epSlugFromCurrent,
  formatEpisodeSlug,
  extractSeriesBaseName,
  extractSeriesBaseNames,
  extractPartNumber,
  extractBaseName,
  ROMAN_MAP,
};
