const FeedbackService = require('./services/FeedbackService');
const logger = require('../../utils/logger');

const FEEDBACK_ENABLED = process.env.ENABLE_FEEDBACK !== 'false';

class FeedbackController {
  constructor(feedbackService) {
    this.feedbackService = feedbackService;
  }

  getFeedbackPage(req, res) {
    if (!FEEDBACK_ENABLED) {
      return res.status(404).render('pages/404', { title: 'Khong tim thay - movieCC' });
    }
    res.render('pages/feedback', {
      title: 'Gop y & Phan hoi - movieCC',
      success: req.query.success === '1',
    });
  }

  submitFeedback = async (req, res) => {
    if (!FEEDBACK_ENABLED) return res.status(404).json({ error: 'Tinh nang da tat' });
    try {
      const { name, email, category, message, movieSlug } = req.body;
      await this.feedbackService.submit({
        name, email, category, message, movieSlug,
        userId: req.session.user ? req.session.user.id : null,
        ip: req.ip,
      });
      logger.info('feedback', 'Feedback moi tu: ' + name);
      res.json({ success: true, message: 'Cam on ban da gui gop y!' });
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        return res.status(429).json({ error: 'Ban da gui qua nhieu. Vui long thu lai sau 1 gio.' });
      }
      logger.error('feedback', 'Loi gui feedback', err);
      res.status(500).json({ error: 'Co loi xay ra, vui long thu lai' });
    }
  };

  getAdminFeedbackPage = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const data = await this.feedbackService.getAll(page, 20);
      const unread = await this.feedbackService.getUnreadCount();
      res.render('admin/feedbacks', {
        title: 'Quan ly Gop y - Admin',
        feedbacks: data.data,
        currentPage: page,
        totalPages: data.totalPages,
        totalCount: data.total,
        unreadCount: unread,
      });
    } catch (err) {
      logger.error('feedback', 'Loi getAdminFeedbackPage', err);
      res.status(500).render('pages/error', { title: 'Loi Server' });
    }
  };

  getAdminFeedbacks = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const data = await this.feedbackService.getAll(page, 20);
      const unread = await this.feedbackService.getUnreadCount();
      res.json({ ...data, unread });
    } catch (err) {
      logger.error('feedback', 'Loi lay feedbacks', err);
      res.status(500).json({ error: 'Loi server' });
    }
  };

  markRead = async (req, res) => {
    try {
      await this.feedbackService.markRead(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Loi server' });
    }
  };

  deleteFeedback = async (req, res) => {
    try {
      const deleted = await this.feedbackService.delete(req.params.id);
      res.json({ success: deleted });
    } catch (err) {
      res.status(500).json({ error: 'Loi server' });
    }
  };
}

module.exports = FeedbackController;
