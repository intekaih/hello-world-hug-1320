const { AuditLog } = require('../models');

const ADMIN_ACTIONS = {
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  TOGGLE_USER_STATUS: 'TOGGLE_USER_STATUS',
  RESET_PASSWORD: 'RESET_PASSWORD',
};

async function logAdminAction(req, action, targetType, targetId, details = {}) {
  try {
    await AuditLog.create({
      action,
      target_type: targetType,
      target_id: targetId,
      admin_id: req.session.user.id,
      admin_username: req.session.user.username,
      details,
      ip: req.ip,
      user_agent: req.headers['user-agent']?.substring(0, 500) || null,
    });
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

module.exports = { ADMIN_ACTIONS, logAdminAction };
