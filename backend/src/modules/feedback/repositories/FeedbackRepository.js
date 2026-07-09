const BaseRepository = require('../../../core/database/BaseRepository');
const { Feedback, VALID_FEEDBACK_CATEGORIES } = require('../../../models/Feedback');

class FeedbackRepository extends BaseRepository {
  constructor() {
    super(Feedback);
  }

  async createFeedback({ name, email, category, message, movieSlug, userId, ip }) {
    return this.create({
      name: name.substring(0, 100),
      email: email ? email.substring(0, 200) : null,
      category: VALID_FEEDBACK_CATEGORIES.includes(category) ? category : 'other',
      message: message.substring(0, 2000),
      movie_slug: movieSlug || null,
      user_id: userId || null,
      ip: ip || null,
    });
  }

  async createWithRateLimit({ name, email, category, message, movieSlug, userId, ip }) {
    if (ip) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await this.model.countDocuments({ ip, created_at: { $gte: oneHourAgo } });
      if (recentCount >= 3) {
        throw new Error('RATE_LIMIT');
      }
    }
    return this.createFeedback({ name, email, category, message, movieSlug, userId, ip });
  }

  async getPaginated(page = 1, limit = 20) {
    return this.paginate({}, page, limit, { created_at: -1 });
  }

  async countUnread() {
    return this.count({ is_read: false });
  }
}

module.exports = FeedbackRepository;
