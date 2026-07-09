const mongoose = require('mongoose');

// F5: cache kết quả dịch của Gemini để chỉ gọi 1 lần / phim / target lang.
// Key: source_hash (sha1 của text gốc) + target_lang → unique.
const translationSchema = new mongoose.Schema(
  {
    movie_slug: { type: String, index: true, maxlength: 200 },
    source_hash: { type: String, required: true, maxlength: 64 },
    source_lang: { type: String, default: "auto", maxlength: 10 },
    target_lang: { type: String, required: true, maxlength: 10 },
    translated_text: { type: String, required: true, maxlength: 20000 },
    model: { type: String, default: "gemini-2.5-flash", maxlength: 50 },
  },
  { timestamps: true },
);

translationSchema.index({ source_hash: 1, target_lang: 1 }, { unique: true });

const Translation = mongoose.model('Translation', translationSchema);

module.exports = { Translation };
