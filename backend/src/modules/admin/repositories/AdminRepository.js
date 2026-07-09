const BaseRepository = require('../../../core/database/BaseRepository');
const { User } = require('../../../models/User');
const { WatchHistory } = require('../../../models/WatchHistory');
const { Favorite } = require('../../../models/Favorite');
const { Feedback } = require('../../../models/Feedback');
const { PageView } = require('../../../models/PageView');
const { hashPassword } = require('../../../models/User');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class AdminRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async getPaginatedUsers(page = 1, limit = 20, search = '') {
    const trimmed = (search || '').substring(0, 100);
    const query = trimmed
      ? {
        $or: [
          { username: { $regex: escapeRegex(trimmed), $options: 'i' } },
          { display_name: { $regex: escapeRegex(trimmed), $options: 'i' } },
        ],
      }
      : {};
    return this.paginate(query, page, limit, { _id: 1 });
  }

  async countUsers(search = '') {
    const trimmed = (search || '').substring(0, 100);
    const query = trimmed
      ? {
        $or: [
          { username: { $regex: escapeRegex(trimmed), $options: 'i' } },
          { display_name: { $regex: escapeRegex(trimmed), $options: 'i' } },
        ],
      }
      : {};
    return this.count(query);
  }

  async countAdmins(activeOnly = false) {
    const query = activeOnly ? { role: 'admin', is_active: true } : { role: 'admin' };
    return this.count(query);
  }

  async getUserStats() {
    const [totalUsers, activeUsers, recentUsers] = await Promise.all([
      this.count(),
      this.count({ is_active: true }),
      this.model.find().sort({ _id: -1 }).limit(5).lean(),
    ]);
    return {
      totalUsers,
      activeUsers,
      recentUsers: recentUsers.map(u => ({ ...u, id: u._id.toString() })),
    };
  }

  async getUserById(id) {
    return this.findById(id);
  }

  async findByUsername(username) {
    return this.findOne({ username });
  }

  async createUser({ username, password, display_name, role = 'user', expires_at, account_source, plan }) {
    const hashedPassword = await hashPassword(password);
    return this.create({ username, password: hashedPassword, display_name, role, is_active: true, expires_at, account_source: account_source || 'manual', plan });
  }

  async updateUserFields(id, updates) {
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }
    if (updates.is_active !== undefined) {
      updates.is_active = !!updates.is_active;
    }
    return this.update(id, updates);
  }

  async resetUserPasswordToTemp(id) {
    if (!this._isValidId(id)) return null;
    const user = await this.model.findById(id).lean();
    if (!user) return null;

    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const crypto = require('crypto');
    let tempPassword = '';
    const bytes = crypto.randomBytes(10);
    for (let i = 0; i < 10; i++) {
      tempPassword += chars[bytes[i] % chars.length];
    }
    const hashed = await hashPassword(tempPassword);
    await this.model.findByIdAndUpdate(id, { password: hashed });
    return {
      tempPassword,
      user: { id, username: user.username, display_name: user.display_name },
    };
  }

  async getViewStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const realFilter = { is_bot: { $ne: true } };
    const realTodayFilter = { is_bot: { $ne: true }, viewed_at: { $gte: today } };

    const [totalViews, todayViews, uniqueIPsResult, botViews] = await Promise.all([
      PageView.countDocuments(realFilter),
      PageView.countDocuments(realTodayFilter),
      PageView.aggregate([
        { $match: realFilter },
        { $group: { _id: '$ip' } },
        { $match: { _id: { $ne: null } } },
        { $count: 'total' },
      ]),
      PageView.countDocuments({ is_bot: true }),
    ]);

    return {
      totalViews,
      todayViews,
      uniqueIPs: uniqueIPsResult[0]?.total || 0,
      botViews,
    };
  }

  async countOnlineUsers(minutesAgo = 5) {
    const threshold = new Date(Date.now() - minutesAgo * 60 * 1000);
    return this.count({ last_active: { $gte: threshold }, is_active: true });
  }

  async deleteUserWithRelations(id) {
    if (!this._isValidId(id)) return false;
    await Promise.all([
      WatchHistory.deleteMany({ user_id: id }),
      Favorite.deleteMany({ user_id: id }),
    ]);
    return this.delete(id);
  }
}

module.exports = AdminRepository;
