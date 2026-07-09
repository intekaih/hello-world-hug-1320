const express = require('express');
const BusinessAccountRepository = require('../modules/businessAccounts/repositories/BusinessAccountRepository');
const BusinessAccountService = require('../modules/businessAccounts/services/BusinessAccountService');
const BusinessAccountController = require('../modules/businessAccounts/BusinessAccountController');
const { requireBusinessApiKey } = require('../middleware/businessApiAuth');
const { adminApiLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const accountRepository = new BusinessAccountRepository();
const accountService = new BusinessAccountService(accountRepository);
const accountController = new BusinessAccountController(accountService);

router.use(requireBusinessApiKey);
router.use(adminApiLimiter);

router.get('/', accountController.listAccounts);
router.post('/', accountController.createAccount);
router.get('/:identifier', accountController.getAccount);
router.patch('/:identifier/lock', accountController.lockAccount);
router.patch('/:identifier/unlock', accountController.unlockAccount);
router.patch('/:identifier/renew', accountController.renewAccount);
router.delete('/:identifier', accountController.deleteAccount);

module.exports = router;
