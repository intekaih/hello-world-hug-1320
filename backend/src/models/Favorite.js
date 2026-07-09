const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    movie_slug: {
      type: String,
      required: true,
      maxlength: 200,
    },
    movie_name: { type: String, maxlength: 500 },
    movie_thumb: { type: String, maxlength: 1000 },
    movie_origin_name: { type: String, maxlength: 500 },
    last_episode: { type: String, maxlength: 50 },
  },
  { timestamps: true },
);

favoriteSchema.pre('save', function(next) {
  if (this.movie_slug) {
    this.movie_slug = this.movie_slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
  next();
});

favoriteSchema.index({ user_id: 1, movie_slug: 1 }, { unique: true });
favoriteSchema.index({ user_id: 1, createdAt: -1 });

const Favorite = mongoose.model('Favorite', favoriteSchema);

module.exports = { Favorite };
