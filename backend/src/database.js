/**
 * MongoDB Database Module - BACKWARD COMPATIBLE LAYER
 *
 * Module nay giữ nguyên API exports de cac controller/route hiện tại
 * hoạt động không đổi. Bên trong, nó import từ các model đã tách.
 *
 * Sau khi tat ca modules refactor xong, file nay se duoc xoa.
 */

const mongoose = require('mongoose');
const dns = require('dns');

// Override DNS de bypass ISP chan SRV queries cua MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Import schemas da tach tu models/
const { User, WatchHistory, Favorite, Watchlist, Notification, Feedback, PageView } = require('./models');

// Import UserRepository for deduplicated functions
const UserRepository = require('./modules/auth/repositories/UserRepository');
const userRepository = new UserRepository();

// ============ CONNECT ============

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[DB] MONGODB_URI chua duoc dat trong .env');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB bi ngat ket noi');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB da ket noi lai');
  });

  mongoose.set('maxTimeMS', 8000);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    maxPoolSize: Math.min(50, parseInt(process.env.DB_POOL_SIZE, 10) || 30), // tăng từ 10 để xử lý nhiều concurrent requests hơn
    minPoolSize: 2,
  });
  console.log('[DB] Ket noi MongoDB thanh cong');

  await migrateFromJson();
}

async function disconnect() {
  await mongoose.connection.close();
  console.log('[DB] Da dong ket noi MongoDB');
}

async function ping() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
  await mongoose.connection.db.admin().command({ ping: 1 });
  return { ok: true };
}

// ============ HELPERS ============

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function toPlain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id.toString();
  return obj;
}

function toLean(doc) {
  if (!doc) return null;
  return { ...doc, id: doc._id.toString() };
}

// ============ USER FUNCTIONS ============

const bcrypt = require('bcryptjs');

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(plaintext, hashed) {
  return bcrypt.compare(plaintext, hashed);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getUsers(page = 1, limit = 20, search = '') {
  const trimmed = search.substring(0, 100);
  const query = trimmed
    ? {
      $or: [
        { username: { $regex: escapeRegex(trimmed), $options: 'i' } },
        { display_name: { $regex: escapeRegex(trimmed), $options: 'i' } },
      ],
    }
    : {};
  const skip = (page - 1) * limit;
  const users = await User.find(query).sort({ _id: 1 }).skip(skip).limit(limit).lean();
  return users.map((u) => ({ ...u, id: u._id.toString() }));
}

async function countUsers(search = '') {
  const trimmed = search.substring(0, 100);
  const query = trimmed
    ? {
      $or: [
        { username: { $regex: escapeRegex(trimmed), $options: 'i' } },
        { display_name: { $regex: escapeRegex(trimmed), $options: 'i' } },
      ],
    }
    : {};
  return User.countDocuments(query);
}

async function countAdmins(activeOnly = false) {
  const query = activeOnly ? { role: 'admin', is_active: true } : { role: 'admin' };
  return User.countDocuments(query);
}

async function getUserStats() {
  const [totalUsers, activeUsers, recentUsers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ is_active: true }),
    User.find().sort({ _id: -1 }).limit(5).lean(),
  ]);
  return {
    totalUsers,
    activeUsers,
    recentUsers: recentUsers.map((u) => ({ ...u, id: u._id.toString() })),
  };
}

async function getUserById(id) {
  if (!isValidId(id)) return null;
  try {
    const user = await User.findById(id).lean();
    return toLean(user);
  } catch { return null; }
}

async function findUserByUsername(username) {
  const user = await User.findOne({ username }).lean();
  return toLean(user);
}

async function createUser({ username, password, display_name, role = 'user', is_active = true }) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    username, password: hashedPassword, display_name, role, is_active: !!is_active,
  });
  return toPlain(user);
}

async function updateUser(id, userData) {
  if (!isValidId(id)) return null;
  const updates = { ...userData };
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
  }
  if (updates.is_active !== undefined) {
    updates.is_active = !!updates.is_active;
  }
  const doc = await User.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!doc) return null;
  return { ...doc, id: doc._id.toString() };
}

async function deleteUser(id) {
  if (!isValidId(id)) return false;
  const result = await User.findByIdAndDelete(id);
  return !!result;
}

// ============ WATCH HISTORY FUNCTIONS ============

async function saveWatchProgress(userId, { movieSlug, episodeSlug, currentTime, duration, movieName, movieThumb, movieOriginName }) {
  const setObj = {
    current_time: currentTime,
    duration,
    last_watched: new Date(),
  };
  if (movieName) setObj.movie_name = movieName;
  if (movieThumb) setObj.movie_thumb = movieThumb;
  if (movieOriginName) setObj.movie_origin_name = movieOriginName;

  const query = { user_id: userId, movie_slug: movieSlug, episode_slug: episodeSlug };

  try {
    await WatchHistory.findOneAndUpdate(
      query,
      { $set: setObj, $setOnInsert: query },
      { upsert: true, new: true },
    );
  } catch (err) {
    await WatchHistory.updateOne(query, { $set: setObj, $setOnInsert: query }, { upsert: true }).catch(() => {});
  }
}

async function getWatchHistory(userId, limit = 24, offset = 0) {
  const docs = await WatchHistory.find({ user_id: userId }).sort({ last_watched: -1 }).skip(offset).limit(limit).lean();
  return docs.map((d) => ({ ...d, id: d._id.toString() }));
}

async function countWatchHistory(userId) {
  return WatchHistory.countDocuments({ user_id: userId });
}

async function getWatchProgress(userId, movieSlug, episodeSlug) {
  const doc = await WatchHistory.findOne({ user_id: userId, movie_slug: movieSlug, episode_slug: episodeSlug }).lean();
  return toLean(doc);
}

async function deleteWatchHistory(userId, id) {
  if (!isValidId(id)) return false;
  const result = await WatchHistory.deleteOne({ _id: id, user_id: userId });
  return result.deletedCount > 0;
}

async function clearWatchHistory(userId) {
  await WatchHistory.deleteMany({ user_id: userId });
}

async function getLatestMovieProgress(userId, movieSlug) {
  const doc = await WatchHistory.findOne({ user_id: userId, movie_slug: movieSlug }).sort({ last_watched: -1 }).lean();
  return toLean(doc);
}

// ============ FAVORITES FUNCTIONS ============

async function addFavorite(userId, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode }) {
  try {
    await Favorite.create({
      user_id: userId,
      movie_slug: movieSlug,
      movie_name: movieName || null,
      movie_thumb: movieThumb || null,
      movie_origin_name: movieOriginName || null,
      last_episode: lastEpisode || null,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function removeFavorite(userId, movieSlug) {
  const result = await Favorite.deleteOne({ user_id: userId, movie_slug: movieSlug });
  return result.deletedCount > 0;
}

async function getFavorites(userId, limit = 24, offset = 0) {
  const docs = await Favorite.find({ user_id: userId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
  return docs.map((d) => ({ ...d, id: d._id.toString() }));
}

async function countFavorites(userId) {
  return Favorite.countDocuments({ user_id: userId });
}

async function isFavorite(userId, movieSlug) {
  const doc = await Favorite.findOne({ user_id: userId, movie_slug: movieSlug }).lean();
  return !!doc;
}

async function clearFavorites(userId) {
  await Favorite.deleteMany({ user_id: userId });
}

// ============ WATCHLIST FUNCTIONS (F4) ============

async function addToWatchlist(userId, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode, note }) {
  try {
    await Watchlist.create({
      user_id: userId,
      movie_slug: movieSlug,
      movie_name: movieName || null,
      movie_thumb: movieThumb || null,
      movie_origin_name: movieOriginName || null,
      last_episode: lastEpisode || null,
      note: note || "",
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function removeFromWatchlist(userId, movieSlug) {
  const result = await Watchlist.deleteOne({ user_id: userId, movie_slug: movieSlug });
  return result.deletedCount > 0;
}

async function getWatchlist(userId, limit = 48, offset = 0) {
  const docs = await Watchlist.find({ user_id: userId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
  return docs.map((d) => ({ ...d, id: d._id.toString() }));
}

async function countWatchlist(userId) {
  return Watchlist.countDocuments({ user_id: userId });
}

async function isInWatchlist(userId, movieSlug) {
  const doc = await Watchlist.findOne({ user_id: userId, movie_slug: movieSlug }).lean();
  return !!doc;
}

// ============ NOTIFICATION FUNCTIONS ============

async function createNotification(userId, { movieSlug, movieName, movieThumb, oldEpisode, newEpisode, latestEpisode }) {
  try {
    await Notification.create({
      user_id: userId, movie_slug: movieSlug, movie_name: movieName,
      movie_thumb: movieThumb, old_episode: oldEpisode, new_episode: newEpisode,
      latest_episode: latestEpisode || newEpisode,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function getNotifications(userId, limit = 20) {
  const docs = await Notification.find({ user_id: userId }).sort({ created_at: -1 }).limit(limit).lean();
  return docs.map((d) => ({ ...d, id: d._id.toString() }));
}

async function countUnreadNotifications(userId) {
  return Notification.countDocuments({ user_id: userId, is_read: false });
}

async function markNotificationsRead(userId) {
  await Notification.updateMany({ user_id: userId, is_read: false }, { is_read: true });
}

async function markNotificationRead(userId, notifId) {
  if (!isValidId(notifId)) return;
  await Notification.updateOne({ _id: notifId, user_id: userId }, { is_read: true });
}

async function updateFavoriteEpisode(userId, movieSlug, newEpisode) {
  await Favorite.updateOne({ user_id: userId, movie_slug: movieSlug }, { last_episode: newEpisode });
}

async function getFavoritesForCheck(userId) {
  return Favorite.find({ user_id: userId }).select('movie_slug movie_name movie_thumb last_episode').lean();
}

// ============ MIGRATE FROM JSON ============

async function migrateFromJson() {
  const path = require('path');
  const fs = require('fs');
  const USERS_FILE = path.join(__dirname, '..', '..', 'data', 'users.json');
  const count = await User.countDocuments();

  if (count === 0 && fs.existsSync(USERS_FILE)) {
    try {
      const jsonData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      for (const user of jsonData) {
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        await User.create({
          username: user.username,
          password: hashedPassword,
          display_name: user.display_name,
          role: user.role || 'user',
          is_active: user.is_active !== false && user.is_active !== 0,
        });
      }
      console.log(`[DB] Migrated ${jsonData.length} users from JSON`);
    } catch (err) {
      console.error('[DB] Migration error:', err);
    }
  }
}

async function updateLastActive(userId) {
  return userRepository.updateLastActive(userId);
}

async function countOnlineUsers(minutesAgo = 5) {
  const threshold = new Date(Date.now() - minutesAgo * 60 * 1000);
  return User.countDocuments({
    last_active: { $gte: threshold },
    is_active: true,
  });
}

// ============ PAGEVIEW FUNCTIONS ============

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
  return BOT_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}

const PAGE_VIEW_BUFFER = [];
const PAGE_VIEW_FLUSH_SIZE = 50;
const PAGE_VIEW_FLUSH_INTERVAL = 5000;
const PAGE_VIEW_MAX_BUFFER = 500;

async function _flushPageViews() {
  if (PAGE_VIEW_BUFFER.length === 0) return;
  const batch = PAGE_VIEW_BUFFER.splice(0, PAGE_VIEW_BUFFER.length);
  try {
    await PageView.insertMany(batch, { ordered: false });
  } catch (e) {
    console.error('[DB] PageView batch insert failed:', e.message);
  }
}

setInterval(_flushPageViews, PAGE_VIEW_FLUSH_INTERVAL).unref();

function recordPageView(movieSlug, episodeSlug, userId, ip, userAgent) {
  const botDetected = isBot(userAgent);
  PAGE_VIEW_BUFFER.push({
    movie_slug: movieSlug,
    episode_slug: episodeSlug || null,
    user_id: userId || null,
    ip: ip || null,
    user_agent: userAgent ? userAgent.substring(0, 500) : null,
    is_bot: botDetected,
    viewed_at: new Date(),
  });
  if (PAGE_VIEW_BUFFER.length >= PAGE_VIEW_MAX_BUFFER) {
    PAGE_VIEW_BUFFER.shift();
  }
  if (PAGE_VIEW_BUFFER.length >= PAGE_VIEW_FLUSH_SIZE) {
    setImmediate(() => _flushPageViews().catch(() => {}));
  }
}

async function getViewStats() {
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

  const uniqueIPs = uniqueIPsResult[0]?.total || 0;
  return { totalViews, todayViews, uniqueIPs, botViews };
}

async function resetUserPasswordToTemp(userId) {
  if (!isValidId(userId)) return null;
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const crypto = require('crypto');
  let tempPassword = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    tempPassword += CHARS[bytes[i] % CHARS.length];
  }

  const hashed = await bcrypt.hash(tempPassword, SALT_ROUNDS);
  await User.findByIdAndUpdate(userId, { password: hashed });

  return {
    tempPassword,
    user: {
      id: userId,
      username: user.username,
      display_name: user.display_name,
    },
  };
}

// ============ FEEDBACK FUNCTIONS ============

const VALID_FEEDBACK_CATEGORIES = ['bug', 'feature', 'content', 'other'];

async function createFeedback({ name, email, category, message, movieSlug, userId, ip }) {
  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await Feedback.countDocuments({ ip, created_at: { $gte: oneHourAgo } });
    if (recentCount >= 3) {
      throw new Error('RATE_LIMIT');
    }
  }
  return Feedback.create({
    name: name.substring(0, 100),
    email: email ? email.substring(0, 200) : null,
    category: VALID_FEEDBACK_CATEGORIES.includes(category) ? category : 'other',
    message: message.substring(0, 2000),
    movie_slug: movieSlug || null,
    user_id: userId || null,
    ip: ip || null,
  });
}

async function getFeedbacks(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Feedback.find().sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Feedback.countDocuments(),
  ]);
  return {
    feedbacks: docs.map(d => ({ ...d, id: d._id.toString() })),
    total,
    totalPages: Math.ceil(total / limit),
  };
}

async function countUnreadFeedbacks() {
  return Feedback.countDocuments({ is_read: false });
}

async function markFeedbackRead(id) {
  if (!isValidId(id)) return;
  await Feedback.updateOne({ _id: id }, { is_read: true });
}

async function deleteFeedback(id) {
  if (!isValidId(id)) return false;
  const result = await Feedback.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

// ============ EXPORTS ============

module.exports = {
  connect, disconnect, ping,
  // User functions
  getUsers, getUserStats, getUserById, findUserByUsername,
  createUser, updateUser, deleteUser, verifyPassword, countUsers, countAdmins,
  // Watch history
  saveWatchProgress, getWatchHistory, countWatchHistory, getWatchProgress,
  deleteWatchHistory, clearWatchHistory, getLatestMovieProgress,
  // Favorites
  addFavorite, removeFavorite, getFavorites, countFavorites,
  isFavorite, clearFavorites,
  // Watchlist (F4)
  addToWatchlist, removeFromWatchlist, getWatchlist, countWatchlist, isInWatchlist,
  // Notifications
  createNotification, getNotifications, countUnreadNotifications,
  markNotificationsRead, markNotificationRead, updateFavoriteEpisode, getFavoritesForCheck,
  // PageView
  recordPageView, getViewStats,
  // User
  updateLastActive, countOnlineUsers, resetUserPasswordToTemp,
  // Feedback
  createFeedback, getFeedbacks, countUnreadFeedbacks, markFeedbackRead, deleteFeedback,
};
