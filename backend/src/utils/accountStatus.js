function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isUserExpired(user, now = new Date()) {
  const expiresAt = toDate(user && user.expires_at);
  return !!expiresAt && expiresAt.getTime() <= now.getTime();
}

function getUserAccountStatus(user, now = new Date()) {
  if (!user) return 'missing';
  if (!user.is_active) return 'locked';
  if (isUserExpired(user, now)) return 'expired';
  return 'active';
}

function normalizeUserId(user) {
  if (!user) return null;
  if (user.id) return String(user.id);
  if (user._id) return String(user._id);
  return null;
}

function toSafeUser(user) {
  if (!user) return null;
  const source = user.toObject ? user.toObject() : { ...user };
  const { password: _password, __v: _version, ...safe } = source;
  const id = normalizeUserId(source);
  if (id) safe.id = id;
  if (safe._id) delete safe._id;
  safe.status = getUserAccountStatus(safe);
  return safe;
}

module.exports = {
  getUserAccountStatus,
  isUserExpired,
  toSafeUser,
};
