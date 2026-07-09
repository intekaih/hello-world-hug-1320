const BaseRepository = require('../../../core/database/BaseRepository');
const { User } = require('../../../models/User');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByUsername(username) {
    return this.findOne({ username });
  }

  async findByRole(role) {
    const docs = await this.model.find({ role }).lean();
    return docs.map(d => this._toLean(d));
  }

  async createWithPassword({ username, password, display_name, role = 'user', is_active = true }) {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    return this.create({ username, password: hashed, display_name, role, is_active });
  }

  async updateWithPassword(id, data) {
    const updates = { ...data };
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
    }
    if (typeof updates.is_active !== 'undefined') {
      updates.is_active = !!updates.is_active;
    }
    return this.update(id, updates);
  }

  async countByRole(role, activeOnly = false) {
    const query = activeOnly ? { role, is_active: true } : { role };
    return this.model.countDocuments(query);
  }

  async getStats() {
    const [total, active] = await Promise.all([
      this.model.countDocuments(),
      this.model.countDocuments({ is_active: true }),
    ]);
    return { total, active };
  }

  async getRecent(limit = 5) {
    const docs = await this.model.find().sort({ _id: -1 }).limit(limit).lean();
    return docs.map(d => this._toLean(d));
  }

  async search(query, page = 1, limit = 20) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      $or: [
        { username: { $regex: escaped, $options: 'i' } },
        { display_name: { $regex: escaped, $options: 'i' } },
      ],
    };
    return this.paginate(filter, page, limit, { _id: 1 });
  }

  async updateLastActive(id) {
    try {
      await this.model.updateOne({ _id: id }, { last_active: new Date() });
    } catch (e) { /* silent */ }
  }

  async countOnline(minutesAgo = 5) {
    const threshold = new Date(Date.now() - minutesAgo * 60 * 1000);
    return this.model.countDocuments({
      last_active: { $gte: threshold },
      is_active: true,
    });
  }

  async resetPasswordToTemp(id) {
    if (!this._isValidId(id)) return null;
    const user = await this.model.findById(id).lean();
    if (!user) return null;

    const CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const crypto = require('crypto');
    let tempPassword = '';
    const bytes = crypto.randomBytes(10);
    for (let i = 0; i < 10; i++) {
      tempPassword += CHARS[bytes[i] % CHARS.length];
    }

    const hashed = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    await this.model.findByIdAndUpdate(id, { password: hashed });

    return {
      tempPassword,
      user: { id: id.toString(), username: user.username, display_name: user.display_name },
    };
  }
}

module.exports = UserRepository;
