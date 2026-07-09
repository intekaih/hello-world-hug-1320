const mongoose = require('mongoose');

const VALID_FEEDBACK_CATEGORIES = ['bug', 'feature', 'content', 'other'];

const feedbackSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true,
  },
  email: {
    type: String,
    maxlength: 200,
    trim: true,
    lowercase: true,
  },
  category: {
    type: String,
    enum: VALID_FEEDBACK_CATEGORIES,
    default: 'other',
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true,
  },
  movie_slug: { type: String, maxlength: 200 },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ip: { type: String, maxlength: 45 },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
}, { timestamps: false });

feedbackSchema.pre('save', function(next) {
  if (this.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) this.email = undefined;
  }
  if (!VALID_FEEDBACK_CATEGORIES.includes(this.category)) this.category = 'other';
  next();
});

feedbackSchema.index({ created_at: -1 });
feedbackSchema.index({ is_read: 1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = { Feedback, VALID_FEEDBACK_CATEGORIES };
