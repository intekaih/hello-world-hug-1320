const logger = require('../../utils/logger');

function sendError(res, err) {
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Loi may chu, vui long thu lai' : err.message,
  });
}

class BusinessAccountController {
  constructor(accountService) {
    this.accountService = accountService;
  }

  createAccount = async (req, res) => {
    try {
      const user = await this.accountService.createAccount(req.body || {});
      logger.info('business-api', `Created account ${user.username}`, {
        ip: req.ip,
        client: req.businessApiClient,
        userId: user.id,
      });
      res.status(201).json({ success: true, user });
    } catch (err) {
      logger.warn('business-api', 'Create account failed', { ip: req.ip, error: err.message });
      sendError(res, err);
    }
  };

  listAccounts = async (req, res) => {
    try {
      const result = await this.accountService.listAccounts(req.query || {});
      res.json({ success: true, ...result });
    } catch (err) {
      logger.error('business-api', 'List accounts failed', err);
      sendError(res, err);
    }
  };

  getAccount = async (req, res) => {
    try {
      const user = await this.accountService.getAccount(req.params.identifier);
      res.json({ success: true, user });
    } catch (err) {
      sendError(res, err);
    }
  };

  lockAccount = async (req, res) => {
    try {
      const user = await this.accountService.lockAccount(req.params.identifier, req.body || {});
      logger.info('business-api', `Locked account ${user.username}`, {
        ip: req.ip,
        client: req.businessApiClient,
        userId: user.id,
      });
      res.json({ success: true, user });
    } catch (err) {
      sendError(res, err);
    }
  };

  unlockAccount = async (req, res) => {
    try {
      const user = await this.accountService.unlockAccount(req.params.identifier);
      logger.info('business-api', `Unlocked account ${user.username}`, {
        ip: req.ip,
        client: req.businessApiClient,
        userId: user.id,
      });
      res.json({ success: true, user });
    } catch (err) {
      sendError(res, err);
    }
  };

  renewAccount = async (req, res) => {
    try {
      const user = await this.accountService.renewAccount(req.params.identifier, req.body || {});
      logger.info('business-api', `Renewed account ${user.username}`, {
        ip: req.ip,
        client: req.businessApiClient,
        userId: user.id,
        expires_at: user.expires_at,
      });
      res.json({ success: true, user });
    } catch (err) {
      sendError(res, err);
    }
  };

  deleteAccount = async (req, res) => {
    try {
      const user = await this.accountService.deleteAccount(req.params.identifier);
      logger.info('business-api', `Deleted account ${user.username}`, {
        ip: req.ip,
        client: req.businessApiClient,
        userId: user.id,
      });
      res.json({ success: true, deleted: user });
    } catch (err) {
      sendError(res, err);
    }
  };
}

module.exports = BusinessAccountController;
