const AdminRepository = require('../repositories/AdminRepository');
const { Feedback } = require('../../../models/Feedback');

const VALID_ROLES = ['user', 'admin', 'moderator'];
const BOT_UA_PATTERNS = [
  'facebookexternalhit', 'facebot', 'facebookcatalog',
  'googlebot', 'bingbot', 'yandexbot', 'baiduspider',
  'duckduckbot', 'slurp', 'sogou', 'exabot',
  'ia_archiver', 'archive.org_bot',
  'twitterbot', 'linkedinbot', 'telegrambot', 'whatsapp',
  'discordbot', 'slackbot', 'skypeuripreview',
  'applebot', 'amazonbot', 'bytespider', 'petalbot',
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',
  'rogerbot', 'screaming frog', 'sitebulb',
  'pingdom', 'uptimerobot', 'statuscake',
  'headlesschrome', 'phantomjs', 'puppeteer',
  'crawl', 'spider', 'bot/', 'bot;',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_UA_PATTERNS.some(pattern => ua.includes(pattern));
}

class AdminService {
  constructor(adminRepository) {
    this.adminRepo = adminRepository;
  }

  async getDashboardData() {
    const [stats, viewStats, onlineUsers] = await Promise.all([
      this.adminRepo.getUserStats(),
      this.adminRepo.getViewStats(),
      this.adminRepo.countOnlineUsers(5),
    ]);
    return {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeUsers,
      onlineUsers,
      totalViews: viewStats.totalViews,
      todayViews: viewStats.todayViews,
      uniqueIPs: viewStats.uniqueIPs,
      botViews: viewStats.botViews,
      recentUsers: stats.recentUsers,
    };
  }

  async getUsers(page = 1, limit = 20, search = '') {
    return this.adminRepo.getPaginatedUsers(page, limit, search);
  }

  async countUsers(search = '') {
    return this.adminRepo.countUsers(search);
  }

  async createUser({ username, password, display_name, role, expires_at, account_source, plan }) {
    if (!username || !password || !display_name) {
      throw new Error('Thieu thong tin bat buoc');
    }
    if (username.length < 3 || username.length > 50) {
      throw new Error('Username phai tu 3-50 ky tu');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username chi chua chu, so va dau gach duoi');
    }
    if (!VALID_ROLES.includes(role)) {
      throw new Error('Role khong hop le');
    }
    const existing = await this.adminRepo.findByUsername(username);
    if (existing) {
      throw new Error('Ten dang nhap da ton tai');
    }
    return this.adminRepo.createUser({ username, password, display_name, role, expires_at, account_source, plan });
  }

  async updateUser(adminId, targetUserId, updates) {
    if (adminId === targetUserId) {
      throw new Error('Khong the tu cap nhat chinh minh');
    }
    const ALLOWED = ['username', 'password', 'display_name', 'role', 'is_active', 'expires_at', 'account_source', 'plan'];
    const sanitized = {};
    for (const key of ALLOWED) {
      if (updates[key] !== undefined) sanitized[key] = updates[key];
    }
    if (sanitized.role && !VALID_ROLES.includes(sanitized.role)) {
      throw new Error('Role khong hop le');
    }
    if (sanitized.username) {
      const existing = await this.adminRepo.findByUsername(sanitized.username);
      if (existing && existing.id !== targetUserId) {
        throw new Error('Ten dang nhap da ton tai');
      }
    }
    const updated = await this.adminRepo.updateUserFields(targetUserId, sanitized);
    if (!updated) throw new Error('Khong tim thay nguoi dung');
    const { password: _, ...safe } = updated;
    return safe;
  }

  async deleteUser(adminId, targetUserId) {
    if (adminId === targetUserId) {
      throw new Error('Khong the xoa chinh minh');
    }
    const user = await this.adminRepo.getUserById(targetUserId);
    if (!user) throw new Error('Khong tim thay nguoi dung');
    if (user.role === 'admin') {
      const adminCount = await this.adminRepo.countAdmins(false);
      if (adminCount <= 1) {
        throw new Error('Khong the xoa tai khoan admin cuoi cung');
      }
    }
    const deleted = await this.adminRepo.deleteUserWithRelations(targetUserId);
    if (!deleted) throw new Error('Khong tim thay nguoi dung');
    return { success: true };
  }

  async toggleUserStatus(adminId, targetUserId) {
    if (adminId === targetUserId) {
      throw new Error('Khong the tu vo hieu hoa chinh minh');
    }
    const user = await this.adminRepo.getUserById(targetUserId);
    if (!user) throw new Error('Khong tim thay nguoi dung');
    if (user.role === 'admin' && user.is_active) {
      const activeAdminCount = await this.adminRepo.countAdmins(true);
      if (activeAdminCount <= 1) {
        throw new Error('Khong the khoa tai khoan admin hoat dong cuoi cung');
      }
    }
    const updated = await this.adminRepo.updateUserFields(targetUserId, {
      is_active: !user.is_active,
    });
    if (!updated) throw new Error('Khong tim thay nguoi dung');
    const { password: _, ...safe } = updated;
    return safe;
  }

  async resetPassword(adminId, targetUserId) {
    if (adminId === targetUserId) {
      throw new Error('Khong the reset mat khau cua chinh minh');
    }
    return this.adminRepo.resetUserPasswordToTemp(targetUserId);
  }

  async getFeedbacks(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      Feedback.find().sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      Feedback.countDocuments(),
    ]);
    return {
      data: docs.map(d => ({ ...d, id: d._id.toString() })),
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadFeedbackCount() {
    return Feedback.countDocuments({ is_read: false });
  }

  async markFeedbackRead(id) {
    if (!this.adminRepo._isValidId(id)) return;
    await Feedback.updateOne({ _id: id }, { is_read: true });
  }

  async deleteFeedback(id) {
    if (!this.adminRepo._isValidId(id)) return false;
    const result = await Feedback.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}

module.exports = AdminService;
