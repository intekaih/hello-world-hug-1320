const mongoose = require('mongoose');

const watchHistorySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  movie_slug: { type: String, required: true },
  episode_slug: { type: String, required: true },
  current_time: {
    type: Number,
    default: 0,
    min: 0,
    max: 86400,
  },
  duration: {
    type: Number,
    default: 0,
    min: 0,
    max: 86400,
  },
  movie_name: { type: String, maxlength: 500 },
  movie_thumb: String,
  movie_origin_name: { type: String, maxlength: 500 },
  last_watched: { type: Date, default: Date.now },
}, { timestamps: false });

watchHistorySchema.pre('save', function(next) {
  if (this.current_time < 0) this.current_time = 0;
  if (this.duration < 0) this.duration = 0;
  if (this.current_time > this.duration && this.duration > 0) {
    this.current_time = this.duration;
  }
  next();
});

watchHistorySchema.index({ user_id: 1, movie_slug: 1, episode_slug: 1 }, { unique: true });
watchHistorySchema.index({ user_id: 1, last_watched: -1 });

const WatchHistory = mongoose.model('WatchHistory', watchHistorySchema);

module.exports = { WatchHistory };
