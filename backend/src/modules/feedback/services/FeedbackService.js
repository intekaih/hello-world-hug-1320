const FeedbackRepository = require('../repositories/FeedbackRepository');

class FeedbackService {
  constructor(feedbackRepository) {
    this.feedbackRepo = feedbackRepository;
  }

  async submit({ name, email, category, message, movieSlug, userId, ip }) {
    if (!name || !name.trim()) throw new Error('Vui long nhap ten');
    if (!message || message.trim().length < 10) throw new Error('Noi dung phai co it nhat 10 ky tu');
    if (message.length > 2000) throw new Error('Noi dung toi da 2000 ky tu');
    return this.feedbackRepo.createWithRateLimit({
      name: name.trim(), email, category, message: message.trim(), movieSlug, userId, ip,
    });
  }

  async getAll(page = 1, limit = 20) {
    return this.feedbackRepo.getPaginated(page, limit);
  }

  async getUnreadCount() {
    return this.feedbackRepo.countUnread();
  }

  async markRead(id) {
    return this.feedbackRepo.update(id, { is_read: true });
  }

  async delete(id) {
    return this.feedbackRepo.delete(id);
  }
}

module.exports = FeedbackService;
