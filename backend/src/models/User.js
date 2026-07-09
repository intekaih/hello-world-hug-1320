const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const VALID_ROLES = ['user', 'admin', 'moderator'];
const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    display_name: { type: String, required: true },
    role: {
      type: String,
      default: 'user',
      validate: {
        validator: function(v) { return VALID_ROLES.includes(v); },
        message: 'Role phai la mot trong: user, admin, moderator'
      }
    },
    is_active: { type: Boolean, default: true },
    last_active: { type: Date },
    expires_at: { type: Date, default: null },
    locked_at: { type: Date, default: null },
    lock_reason: { type: String, maxlength: 500, default: null },
    account_source: {
      type: String,
      enum: ['manual', 'business_api'],
      default: 'manual',
    },
    external_ref: { type: String, trim: true, maxlength: 120, default: null },
    plan: { type: String, trim: true, maxlength: 50, default: null },
  },
  { timestamps: true },
);

userSchema.pre('save', function(next) {
  if (!VALID_ROLES.includes(this.role)) this.role = 'user';
  if (this.username && (this.username.length < 3 || this.username.length > 50)) {
    return next(new Error('Username phai tu 3-50 ky tu'));
  }
  if (this.display_name && (this.display_name.length < 1 || this.display_name.length > 100)) {
    return next(new Error('Display name phai tu 1-100 ky tu'));
  }
  next();
});

userSchema.index({ last_active: -1 });
userSchema.index({ username: 1 });
userSchema.index({ expires_at: 1 });
userSchema.index({ account_source: 1, createdAt: -1 });
userSchema.index({ external_ref: 1 }, { sparse: true });

userSchema.methods.comparePassword = async function(plaintext) {
  return bcrypt.compare(plaintext, this.password);
};

userSchema.statics.hashPassword = async function(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const User = mongoose.model('User', userSchema);

module.exports = { User, VALID_ROLES };
