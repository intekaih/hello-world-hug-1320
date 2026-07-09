const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { doubleCsrfProtection } = require('../middleware/csrf');
const { loginLimiter } = require('../middleware/rateLimit');
const { useNewAuthModule } = require('../core/config/features');

// Feature flag: choose controller
let authCtrl;
if (useNewAuthModule) {
  const { authController } = require('../core/di/container');
  authCtrl = authController;
} else {
  authCtrl = require('../controllers/authController');
}

router.get('/dang-nhap', authCtrl.getLogin);
router.get('/quen-mat-khau', authCtrl.getForgotPassword);

router.post(
  '/dang-nhap',
  loginLimiter,
  doubleCsrfProtection,
  [
    body('username')
      .notEmpty()
      .withMessage('Ten dang nhap khong duoc de trong'),
    body('password').notEmpty().withMessage('Mat khau khong duoc de trong'),
  ],
  authCtrl.postLogin,
);

router.post('/dang-xuat', doubleCsrfProtection, authCtrl.logout);
router.get('/dang-xuat', (req, res) => res.redirect('/'));

// Ho so
router.get('/ho-so', requireAuth, authCtrl.getProfile);
router.post(
  '/ho-so',
  requireAuth,
  doubleCsrfProtection,
  [
    body('display_name')
      .trim()
      .notEmpty()
      .withMessage('Ten hien thi khong duoc de trong')
      .isLength({ max: 50 })
      .withMessage('Ten hien thi toi da 50 ky tu'),
  ],
  authCtrl.updateProfile,
);

// Redirect tu duong dan cu (backward compat)
router.get('/forgot-password', (req, res) =>
  res.redirect(301, '/quen-mat-khau'),
);
router.get('/login', (req, res) => res.redirect(301, '/dang-nhap'));
router.get('/logout', (req, res) => res.redirect(301, '/dang-xuat'));
router.get('/profile', (req, res) => res.redirect(301, '/ho-so'));

module.exports = router;
