const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    movie_slug: { type: String, required: true, maxlength: 200 },
    movie_name: { type: String, maxlength: 500 },
    movie_thumb: { type: String, maxlength: 1000 },
    movie_origin_name: { type: String, maxlength: 500 },
    last_episode: { type: String, maxlength: 50 },
    note: { type: String, maxlength: 200, default: "" },
  },
  { timestamps: true },
);

watchlistSchema.pre('save', function (next) {
  if (this.movie_slug) {
    this.movie_slug = this.movie_slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
  next();
});

watchlistSchema.index({ user_id: 1, movie_slug: 1 }, { unique: true });
watchlistSchema.index({ user_id: 1, createdAt: -1 });

const Watchlist = mongoose.model('Watchlist', watchlistSchema);

module.exports = { Watchlist };
