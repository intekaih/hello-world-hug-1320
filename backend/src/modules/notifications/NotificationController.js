const NotificationService = require('./services/NotificationService');
const logger = require('../../utils/logger');
const { cache } = require('../../core/cache');

const checkCache = cache.notificationCheck;

class NotificationController {
  constructor(notificationService) {
    this.notifService = notificationService;
  }

  getNotifications = async (req, res) => {
    try {
      const notifications = await this.notifService.getNotifications(req.session.user.id, 20);
      res.json(notifications);
    } catch (err) {
      logger.error('notification', 'Loi lay thong bao', err);
      res.status(500).json({ error: 'Loi server' });
    }
  };

  getUnreadCount = async (req, res) => {
    try {
      const count = await this.notifService.getUnreadCount(req.session.user.id);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: 'Loi server' });
    }
  };

  markAllRead = async (req, res) => {
    try {
      await this.notifService.markAllRead(req.session.user.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Loi server' });
    }
  };

  markRead = async (req, res) => {
    try {
      await this.notifService.markRead(req.session.user.id, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Loi server' });
    }
  };

  checkNewEpisodes = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const cacheKey = `notif_check_${userId}`;

      if (checkCache.get(cacheKey)) {
        const count = await this.notifService.getUnreadCount(userId);
        return res.json({ checked: false, count });
      }

      const { sourceManager } = require('../../config/providers');
      const result = await this.notifService.checkAndNotifyNewEpisodes(userId, sourceManager);

      checkCache.set(cacheKey, true);
      res.json({ checked: true, count: result.count, newEpisodes: result.newEpisodes });
    } catch (err) {
      logger.error('notification', 'Loi kiem tra tap moi', err);
      res.status(500).json({ error: 'Loi server' });
    }
  };
}

module.exports = NotificationController;
