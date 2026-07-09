const AdminService = require('./services/AdminService');
const logger = require('../../utils/logger');
const { validationResult } = require('express-validator');

const FEEDBACK_ENABLED = process.env.ENABLE_FEEDBACK !== 'false';

function safeUser(user) {
  if (!user) return null;
  const { password: _, ...safe } = typeof user === 'object' && user.toObject
    ? user.toObject()
    : { ...user };
  if (safe.id) delete safe.id;
  if (safe._id) {
    safe.id = safe._id.toString();
    delete safe._id;
  }
  return safe;
}

class AdminController {
  constructor(adminService) {
    this.adminService = adminService;
  }

  getDashboard = async (req, res) => {
    try {
      const data = await this.adminService.getDashboardData();
      res.render('admin/dashboard', {
        title: 'Bang dieu khien - movieCC',
        stats: data,
        recentUsers: data.recentUsers,
      });
    } catch (err) {
      logger.error('admin', 'Loi tai dashboard', err);
      res.status(500).render('pages/500', {
        title: 'Loi may chu - movieCC',
        error: process.env.NODE_ENV === 'development' ? err.message : null,
      });
    }
  };

  getUsers = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const search = (req.query.q || '').trim();
      const [result, totalUsers] = await Promise.all([
        this.adminService.getUsers(page, limit, search),
        this.adminService.countUsers(search),
      ]);
      res.render('admin/users', {
        title: 'Quan ly tai khoan - movieCC',
        users: result.data,
        currentPage: page,
        totalPages: result.totalPages,
        totalUsers,
        searchQuery: search,
      });
    } catch (err) {
      logger.error('admin', 'Loi tai danh sach users', err);
      res.status(500).render('pages/500', {
        title: 'Loi may chu - movieCC',
        error: process.env.NODE_ENV === 'development' ? err.message : null,
      });
    }
  };

  createUser = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }
      const { username, password, display_name, role, expires_at, account_source, plan } = req.body;
      const newUser = await this.adminService.createUser({ username, password, display_name, role, expires_at: expires_at || null, account_source: account_source || 'manual', plan });
      logger.info('security', `Admin tao tai khoan: ${username} (role: ${role})`, {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      });
      res.json({ success: true, message: 'Tao tai khoan thanh cong', user: safeUser(newUser) });
    } catch (err) {
      if (err.message.includes('da ton tai')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      logger.error('admin', 'Loi tao tai khoan', err);
      res.status(500).json({ success: false, message: 'Loi may chu, vui long thu lai' });
    }
  };

  updateUser = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }
      const user = await this.adminService.updateUser(
        req.session.user.id, req.params.id, req.body,
      );
      logger.info('security', `Admin cap nhat user ${req.params.id}: [${Object.keys(req.body).join(', ')}]`, {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      });
      res.json({ success: true, message: 'Cap nhat thanh cong', user: safeUser(user) });
    } catch (err) {
      if (err.message.includes('da ton tai') || err.message.includes('Khong tim thay')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      logger.error('admin', 'Loi cap nhat tai khoan', err);
      res.status(500).json({ success: false, message: 'Loi may chu, vui long thu lai' });
    }
  };

  deleteUser = async (req, res) => {
    try {
      await this.adminService.deleteUser(req.session.user.id, req.params.id);
      logger.info('security', `Admin xoa user ${req.params.id}`, {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      });
      res.json({ success: true, message: 'Xoa tai khoan thanh cong' });
    } catch (err) {
      if (err.message.includes('cuoi cung') || err.message.includes('chinh minh') || err.message.includes('Khong tim thay')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      logger.error('admin', 'Loi xoa tai khoan', err);
      res.status(500).json({ success: false, message: 'Loi may chu, vui long thu lai' });
    }
  };

  toggleUserStatus = async (req, res) => {
    try {
      const user = await this.adminService.toggleUserStatus(req.session.user.id, req.params.id);
      logger.info('security', `Admin toggle status user ${req.params.id}`, {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      });
      res.json({ success: true, message: 'Cap nhat trang thai thanh cong', user: safeUser(user) });
    } catch (err) {
      if (err.message.includes('cuoi cung') || err.message.includes('chinh minh') || err.message.includes('Khong tim thay')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      logger.error('admin', 'Loi toggle trang thai', err);
      res.status(500).json({ success: false, message: 'Loi may chu, vui long thu lai' });
    }
  };

  resetPassword = async (req, res) => {
    try {
      const result = await this.adminService.resetPassword(req.session.user.id, req.params.id);
      logger.info('security', `Admin reset mat khau cho user ${req.params.id}`, {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      });
      res.json({
        success: true,
        message: 'Dat lai mat khau thanh cong',
        tempPassword: result.tempPassword,
        username: result.user.username,
        display_name: result.user.display_name,
      });
    } catch (err) {
      if (err.message.includes('chinh minh')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      logger.error('admin', 'Loi reset mat khau', err);
      res.status(500).json({ success: false, message: 'Loi may chu, vui long thu lai' });
    }
  };

  getFeedbacksPage = async (req, res) => {
    if (!FEEDBACK_ENABLED) {
      return res.status(404).render('pages/404', { title: 'Khong tim thay - movieCC' });
    }
    try {
      const page = parseInt(req.query.page) || 1;
      const data = await this.adminService.getFeedbacks(page, 20);
      const unread = await this.adminService.getUnreadFeedbackCount();
      res.render('admin/feedbacks', {
        title: 'Quan ly Gop y - Admin',
        feedbacks: data.data,
        currentPage: page,
        totalPages: data.totalPages,
        totalCount: data.total,
        unreadCount: unread,
      });
    } catch (err) {
      logger.error('admin', 'Loi tai feedbacks', err);
      res.status(500).render('pages/500', { title: 'Loi may chu - movieCC' });
    }
  };
}

module.exports = AdminController;
