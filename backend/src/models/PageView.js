const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
  movie_slug: { type: String, required: true, maxlength: 200 },
  episode_slug: { type: String, maxlength: 100 },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ip: { type: String, maxlength: 45 },
  user_agent: { type: String, maxlength: 500 },
  is_bot: { type: Boolean, default: false },
  viewed_at: { type: Date, default: Date.now },
}, { timestamps: false });

pageViewSchema.index({ viewed_at: -1 });
pageViewSchema.index({ movie_slug: 1 });
pageViewSchema.index({ is_bot: 1, viewed_at: -1 });
pageViewSchema.index({ ip: 1, is_bot: 1 });
// TTL index: tu dong xoa PageView cu hon 90 ngay
pageViewSchema.index(
  { viewed_at: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

const PageView = mongoose.model('PageView', pageViewSchema);

module.exports = { PageView };
