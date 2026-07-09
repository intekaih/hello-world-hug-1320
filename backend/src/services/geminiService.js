/**
 * F5: Gemini Translator Service
 *
 * Dùng Gemini REST API (không cần SDK) để dịch mô tả phim sang tiếng Việt.
 * Kết quả cache trong Mongo (Translation model) để chỉ gọi 1 lần / source.
 *
 * Env: GEMINI_API_KEY
 */

const crypto = require("crypto");
const { Translation } = require("../models");
const logger = require("../utils/logger");
const { cache } = require("../core/cache");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 12_000;

// Hot cache trong RAM 1h — tránh hit Mongo cho request lặp ngay sau nhau
const memCache = cache.gemini;

// Concurrency limit để không quá quota Gemini free tier
let inflight = 0;
const MAX_INFLIGHT = 4;
const queue = [];

// Dedupe in-flight requests cùng source — tránh N parallel request cùng text
// trùng → chỉ 1 lần gọi API, các caller khác chờ Promise đã có.
const inflightByHash = new Map();

function acquireSlot() {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (inflight < MAX_INFLIGHT) {
        inflight++;
        resolve();
      } else {
        queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function releaseSlot() {
  inflight--;
  const next = queue.shift();
  if (next) next();
}

function hashText(text) {
  return crypto.createHash("sha1").update(text, "utf8").digest("hex");
}

/**
 * Gọi Gemini API để dịch text.
 * Trả về object { translated_text, cached: boolean, source: "memory"|"db"|"api" }
 */
async function translate({ text, targetLang = "vi", movieSlug = null }) {
  if (!text || typeof text !== "string") {
    throw new Error("text required");
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY chưa cấu hình");
  }

  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (cleaned.length < 5) {
    return { translated_text: cleaned, cached: true, source: "skip" };
  }
  const sourceHash = hashText(cleaned + "|" + targetLang);

  // 1. Hot memory cache
  const memHit = memCache.get(sourceHash);
  if (memHit) return { translated_text: memHit, cached: true, source: "memory" };

  // Toàn bộ phần còn lại được wrap trong async IIFE bên trong dedupe

  // 2. Mongo cache
  const dbHit = await Translation.findOne({ source_hash: sourceHash, target_lang: targetLang }).lean();
  if (dbHit) {
    memCache.set(sourceHash, dbHit.translated_text);
    return { translated_text: dbHit.translated_text, cached: true, source: "db" };
  }

  // 2b. In-flight dedupe — request cùng text đang chạy → đợi chung kết quả
  const inflightKey = `${sourceHash}:${targetLang}`;
  const existing = inflightByHash.get(inflightKey);
  if (existing) {
    const text = await existing;
    return { translated_text: text, cached: true, source: "memory" };
  }

  // 3. Call Gemini API — đặt promise vào map TRƯỚC khi await slot
  const promise = (async () => {
    await acquireSlot();
    try {
    const targetLangName = targetLang === "vi" ? "tiếng Việt" : targetLang;
    const prompt = `Bạn là dịch giả phim chuyên nghiệp. Hãy dịch đoạn mô tả phim sau sang ${targetLangName} một cách tự nhiên, giữ nguyên tên riêng (tên nhân vật, địa danh) và tên phim. Chỉ trả về văn bản đã dịch, không thêm bất kỳ giải thích, dấu ngoặc, hay tiền tố nào.\n\nMô tả gốc:\n${cleaned}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Gemini ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!translated) {
      throw new Error("Gemini response empty");
    }

    // 4. Persist
    try {
      await Translation.updateOne(
        { source_hash: sourceHash, target_lang: targetLang },
        {
          $set: {
            movie_slug: movieSlug,
            source_lang: "auto",
            translated_text: translated.slice(0, 20000),
            model: MODEL,
          },
          $setOnInsert: { source_hash: sourceHash, target_lang: targetLang },
        },
        { upsert: true },
      );
    } catch (dbErr) {
      // Duplicate key (race) — ignore
      if (dbErr.code !== 11000) {
        logger.warn("gemini", "Lỗi cache Translation", dbErr.message);
      }
    }

      memCache.set(sourceHash, translated);
      return translated;
    } finally {
      releaseSlot();
    }
  })();

  inflightByHash.set(inflightKey, promise);
  try {
    const translated = await promise;
    return { translated_text: translated, cached: false, source: "api" };
  } finally {
    inflightByHash.delete(inflightKey);
  }
}

module.exports = { translate };
