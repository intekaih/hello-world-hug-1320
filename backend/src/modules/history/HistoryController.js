const HistoryService = require('./services/HistoryService');
const logger = require('../../utils/logger');

class HistoryController {
  constructor(historyService) {
    this.historyService = historyService;
  }

  saveWatchProgress = async (req, res) => {
    try {
      const { movieSlug, episodeSlug, currentTime, duration, movieName, movieThumb, movieOriginName } = req.body;
      if (!movieSlug || !episodeSlug) {
        return res.status(400).json({ success: false, message: 'Thieu thong tin' });
      }
      await this.historyService.saveProgress(req.session.user.id, {
        movieSlug, episodeSlug, currentTime, duration, movieName, movieThumb, movieOriginName,
      });
      res.json({ success: true });
    } catch (err) {
      logger.error('history', 'Loi luu tien trinh', err);
      res.status(500).json({ success: false, message: 'Loi server' });
    }
  };

  getWatchProgress = async (req, res) => {
    try {
      const progress = await this.historyService.getProgress(
        req.session.user.id, req.params.slug, req.params.episode,
      );
      res.json({ success: true, progress: progress || null });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  };

  getLatestProgress = async (req, res) => {
    try {
      const progress = await this.historyService.getLatestProgress(req.session.user.id, req.params.slug);
      res.json({ success: true, progress: progress || null });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  };

  deleteWatchHistoryItem = async (req, res) => {
    try {
      const deleted = await this.historyService.deleteItem(req.session.user.id, req.params.id);
      res.json({ success: deleted });
    } catch (err) {
      logger.error('history', 'Loi xoa history', err);
      res.status(500).json({ success: false });
    }
  };

  clearWatchHistory = async (req, res) => {
    try {
      await this.historyService.clear(req.session.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  };

  getHistoryPage = async (req, res) => {
    try {
      const perPage = 24;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const total = await this.historyService.getCount(req.session.user.id);
      const totalPages = Math.ceil(total / perPage);
      const result = await this.historyService.getPage(req.session.user.id, page, perPage);

      res.render('pages/history', {
        title: 'Lich su xem - movieCC',
        history: result.data,
        totalHistory: total,
        currentPage: page,
        totalPages,
      });
    } catch (err) {
      logger.error('history', 'Loi trang lich su', err);
      res.redirect('/?msg=' + encodeURIComponent('Khong the tai lich su xem') + '&msgtype=error');
    }
  };
}

module.exports = HistoryController;
