const UserRepository = require('../repositories/UserRepository');
const bcrypt = require('bcryptjs');
const { isUserExpired } = require('../../../utils/accountStatus');

class AuthService {
  constructor(userRepository) {
    this.userRepo = userRepository;
  }

  async validateCredentials(username, password) {
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      return { valid: false, reason: 'USER_NOT_FOUND' };
    }
    if (!user.is_active) {
      return { valid: false, reason: 'ACCOUNT_DISABLED' };
    }
    if (isUserExpired(user)) {
      return { valid: false, reason: 'ACCOUNT_EXPIRED' };
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return { valid: false, reason: 'WRONG_PASSWORD' };
    }
    return { valid: true, user };
  }

  async getUserById(id) {
    return this.userRepo.findById(id);
  }

  async updateProfile(userId, { display_name, password }) {
    const updateData = { display_name };
    if (password) {
      updateData.password = password;
    }
    return this.userRepo.updateWithPassword(userId, updateData);
  }

  async isActive(userId) {
    const user = await this.userRepo.findById(userId);
    return user && user.is_active && !isUserExpired(user);
  }

  async updateLastActive(userId) {
    return this.userRepo.updateLastActive(userId);
  }
}

module.exports = AuthService;
