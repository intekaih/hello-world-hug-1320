const BaseRepository = require('../../../core/database/BaseRepository');
const { User } = require('../../../models/User');
const { WatchHistory } = require('../../../models/WatchHistory');
const { Favorite } = require('../../../models/Favorite');
const { Watchlist } = require('../../../models/Watchlist');
const { Notification } = require('../../../models/Notification');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
const MANAGED_FILTER = { account_source: 'business_api', role: 'user' };

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class BusinessAccountRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findAnyByUsername(username) {
    return this.findOne({ username });
  }

  async findManagedByIdentifier(identifier) {
    const filter = { ...MANAGED_FILTER };
    if (this._isValidId(identifier)) {
      filter.$or = [{ _id: identifier }, { username: identifier }];
    } else {
      filter.username = identifier;
    }

    const doc = await this.model.findOne(filter).lean();
    return this._toLean(doc);
  }

  async createAccount(data) {
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.create({
      username: data.username,
      password: hashedPassword,
      display_name: data.display_name,
      role: 'user',
      is_active: true,
      expires_at: data.expires_at,
      account_source: 'business_api',
      external_ref: data.external_ref || null,
      plan: data.plan || null,
    });
  }

  async updateManaged(id, updates) {
    if (!this._isValidId(id)) return null;
    const doc = await this.model.findOneAndUpdate(
      { _id: id, ...MANAGED_FILTER },
      updates,
      { new: true },
    ).lean();
    return this._toLean(doc);
  }

  async deleteManagedWithRelations(id) {
    if (!this._isValidId(id)) return false;
    const user = await this.model.findOne({ _id: id, ...MANAGED_FILTER }).lean();
    if (!user) return false;

    await Promise.all([
      WatchHistory.deleteMany({ user_id: id }),
      Favorite.deleteMany({ user_id: id }),
      Watchlist.deleteMany({ user_id: id }),
      Notification.deleteMany({ user_id: id }),
    ]);

    const result = await this.model.deleteOne({ _id: id, ...MANAGED_FILTER });
    return result.deletedCount > 0;
  }

  async listManaged({ page = 1, limit = 20, search = '', status = '' }) {
    const now = new Date();
    const query = { ...MANAGED_FILTER };
    const trimmed = (search || '').trim().substring(0, 100);

    if (trimmed) {
      const escaped = escapeRegex(trimmed);
      query.$or = [
        { username: { $regex: escaped, $options: 'i' } },
        { display_name: { $regex: escaped, $options: 'i' } },
        { external_ref: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (status === 'locked') {
      query.is_active = false;
    } else if (status === 'expired') {
      query.is_active = true;
      query.expires_at = { $ne: null, $lte: now };
    } else if (status === 'active') {
      query.is_active = true;
      query.$and = [
        {
          $or: [
            { expires_at: null },
            { expires_at: { $gt: now } },
          ],
        },
      ];
    }

    return this.paginate(query, page, limit, { createdAt: -1, _id: -1 });
  }
}

module.exports = BusinessAccountRepository;
