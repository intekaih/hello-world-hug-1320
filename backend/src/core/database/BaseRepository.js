class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  _isValidId(id) {
    const mongoose = require('mongoose');
    return mongoose.Types.ObjectId.isValid(id);
  }

  _toLean(doc) {
    if (!doc) return null;
    return { ...doc, id: doc._id.toString() };
  }

  _toPlain(doc) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    obj.id = obj._id.toString();
    return obj;
  }

  async findById(id) {
    if (!this._isValidId(id)) return null;
    try {
      const doc = await this.model.findById(id).lean();
      return this._toLean(doc);
    } catch {
      return null;
    }
  }

  async findOne(query) {
    const doc = await this.model.findOne(query).lean();
    return this._toLean(doc);
  }

  async create(data) {
    const doc = await this.model.create(data);
    return this._toPlain(doc);
  }

  async update(id, data) {
    if (!this._isValidId(id)) return null;
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc ? this._toLean(doc) : null;
  }

  async delete(id) {
    if (!this._isValidId(id)) return false;
    const result = await this.model.findByIdAndDelete(id);
    return !!result;
  }

  async paginate(query = {}, page = 1, limit = 20, sort = { _id: -1 }) {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(limit).lean(),
      this.model.countDocuments(query),
    ]);
    return {
      data: docs.map(d => this._toLean(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async count(query = {}) {
    return this.model.countDocuments(query);
  }
}

module.exports = BaseRepository;
