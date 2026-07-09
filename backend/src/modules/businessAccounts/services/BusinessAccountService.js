const { toSafeUser } = require('../../../utils/accountStatus');

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const MAX_DURATION_DAYS = 3650;
const MAX_DURATION_HOURS = MAX_DURATION_DAYS * 24;

function serviceError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
}

function parsePositiveInteger(value, field, max) {
  if (value === undefined || value === null || value === '') return 0;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw serviceError(400, `${field} phai la so nguyen duong`);
  }
  if (number > max) {
    throw serviceError(400, `${field} vuot qua gioi han cho phep`);
  }
  return number;
}

function calculateExpiresAt(input, baseDate = new Date()) {
  const hasExpiresAt = input.expiresAt !== undefined && input.expiresAt !== null && input.expiresAt !== '';
  const hasDuration = input.durationDays !== undefined || input.durationHours !== undefined;

  if (hasExpiresAt && hasDuration) {
    throw serviceError(400, 'Chi duoc chon expiresAt hoac durationDays/durationHours');
  }

  if (hasExpiresAt) {
    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw serviceError(400, 'expiresAt khong hop le');
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw serviceError(400, 'expiresAt phai nam trong tuong lai');
    }
    return expiresAt;
  }

  const days = parsePositiveInteger(input.durationDays, 'durationDays', MAX_DURATION_DAYS);
  const hours = parsePositiveInteger(input.durationHours, 'durationHours', MAX_DURATION_HOURS);
  if (!days && !hours) {
    throw serviceError(400, 'Can chon thoi han bang durationDays, durationHours hoac expiresAt');
  }

  const totalMs = (days * 24 + hours) * 60 * 60 * 1000;
  return new Date(baseDate.getTime() + totalMs);
}

class BusinessAccountService {
  constructor(accountRepository) {
    this.accountRepo = accountRepository;
  }

  async createAccount(input) {
    const username = cleanString(input.username, 50);
    const password = typeof input.password === 'string' ? input.password : '';
    const displayName = cleanString(input.display_name || input.displayName || username, 100);
    const plan = cleanString(input.plan, 50) || null;
    const externalRef = cleanString(input.external_ref || input.externalRef, 120) || null;

    if (!username || !password || !displayName) {
      throw serviceError(400, 'Thieu username, password hoac display_name');
    }
    if (username.length < 3 || username.length > 50 || !USERNAME_RE.test(username)) {
      throw serviceError(400, 'Username phai tu 3-50 ky tu va chi gom chu, so, dau gach duoi');
    }
    if (password.length < 6) {
      throw serviceError(400, 'Mat khau toi thieu 6 ky tu');
    }

    const existing = await this.accountRepo.findAnyByUsername(username);
    if (existing) {
      throw serviceError(409, 'Ten dang nhap da ton tai');
    }

    const expiresAt = calculateExpiresAt(input);
    const user = await this.accountRepo.createAccount({
      username,
      password,
      display_name: displayName,
      expires_at: expiresAt,
      external_ref: externalRef,
      plan,
    });

    return toSafeUser(user);
  }

  async listAccounts(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const status = ['active', 'locked', 'expired'].includes(query.status) ? query.status : '';
    const result = await this.accountRepo.listManaged({
      page,
      limit,
      status,
      search: query.q || query.search || '',
    });
    return {
      ...result,
      data: result.data.map(toSafeUser),
    };
  }

  async getAccount(identifier) {
    const user = await this.accountRepo.findManagedByIdentifier(identifier);
    if (!user) throw serviceError(404, 'Khong tim thay tai khoan business');
    return toSafeUser(user);
  }

  async lockAccount(identifier, input = {}) {
    const user = await this.accountRepo.findManagedByIdentifier(identifier);
    if (!user) throw serviceError(404, 'Khong tim thay tai khoan business');

    const updated = await this.accountRepo.updateManaged(user.id, {
      is_active: false,
      locked_at: new Date(),
      lock_reason: cleanString(input.reason || input.lock_reason, 500) || null,
    });
    return toSafeUser(updated);
  }

  async unlockAccount(identifier) {
    const user = await this.accountRepo.findManagedByIdentifier(identifier);
    if (!user) throw serviceError(404, 'Khong tim thay tai khoan business');

    const updated = await this.accountRepo.updateManaged(user.id, {
      is_active: true,
      locked_at: null,
      lock_reason: null,
    });
    return toSafeUser(updated);
  }

  async renewAccount(identifier, input) {
    const user = await this.accountRepo.findManagedByIdentifier(identifier);
    if (!user) throw serviceError(404, 'Khong tim thay tai khoan business');

    const currentExpiry = user.expires_at ? new Date(user.expires_at) : null;
    const baseDate = currentExpiry && currentExpiry.getTime() > Date.now()
      ? currentExpiry
      : new Date();
    const expiresAt = calculateExpiresAt(input, baseDate);

    const updated = await this.accountRepo.updateManaged(user.id, {
      expires_at: expiresAt,
      plan: input.plan ? cleanString(input.plan, 50) : user.plan || null,
    });
    return toSafeUser(updated);
  }

  async deleteAccount(identifier) {
    const user = await this.accountRepo.findManagedByIdentifier(identifier);
    if (!user) throw serviceError(404, 'Khong tim thay tai khoan business');

    const deleted = await this.accountRepo.deleteManagedWithRelations(user.id);
    if (!deleted) throw serviceError(404, 'Khong tim thay tai khoan business');
    return { id: user.id, username: user.username };
  }
}

module.exports = BusinessAccountService;
