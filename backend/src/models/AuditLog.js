const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // CREATE_USER, UPDATE_USER, DELETE_USER, etc.
  target_type: { type: String, required: true }, // USER, MOVIE, FEEDBACK, etc.
  target_id: { type: String },
  admin_id: { type: String, required: true },
  admin_username: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed }, // Additional context
  ip: { type: String },
  user_agent: { type: String },
}, { timestamps: true });

// Index cho query hiệu quả
auditLogSchema.index({ admin_id: 1, createdAt: -1 });
auditLogSchema.index({ target_type: 1, target_id: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Chỉ cho phép tạo, không cho sửa/xóa (append-only)
auditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('Audit logs cannot be modified');
});
auditLogSchema.pre('findOneAndDelete', function() {
  throw new Error('Audit logs cannot be deleted');
});
auditLogSchema.pre('deleteMany', function() {
  throw new Error('Audit logs cannot be bulk deleted');
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog };
