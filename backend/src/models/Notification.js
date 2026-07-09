const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  movie_slug: { type: String, required: true, maxlength: 200 },
  movie_name: { type: String, maxlength: 500 },
  movie_thumb: { type: String, maxlength: 1000 },
  old_episode: { type: String, maxlength: 50 },
  new_episode: { type: String, maxlength: 50 },
  latest_episode: { type: String, maxlength: 50 },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
}, { timestamps: false });

notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, movie_slug: 1, new_episode: 1 }, { unique: true });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification };
