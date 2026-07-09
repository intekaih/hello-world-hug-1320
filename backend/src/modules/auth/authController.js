const { validationResult } = require('express-validator');
const logger = require('../../utils/logger');

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  getLogin(req, res) {
    if (req.session.user) return res.redirect('/');
    res.render('pages/login', { title: 'Dang nhap - movieCC', layout: false, query: req.query });
  }

  getForgotPassword(req, res) {
    if (req.session.user) return res.redirect('/');
    res.render('pages/forgot-password', {
      title: 'Quen mat khau - movieCC',
      layout: false,
    });
  }

  postLogin = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('pages/login', {
          title: 'Dang nhap - movieCC',
          layout: false,
          error: errors.array()[0].msg,
        });
      }

      // SEC-2: Turnstile bắt buộc trong production (fail-closed).
      // Dev có thể bỏ qua bằng cách KHÔNG đặt FORCE_TURNSTILE.
      const isProd = process.env.NODE_ENV === 'production';
      const skipTurnstile = !isProd && !process.env.FORCE_TURNSTILE;
      const turnstileToken = req.body['cf-turnstile-response'];

      if (!skipTurnstile) {
        // Fail-closed: production mà chưa cấu hình secret → từ chối đăng nhập
        if (isProd && !process.env.TURNSTILE_SECRET_KEY) {
          logger.error('security', 'TURNSTILE_SECRET_KEY thieu trong production', { ip: req.ip });
          return res.render('pages/login', {
            title: 'Dang nhap - movieCC',
            layout: false,
            error: 'He thong xac thuc tam thoi khong san sang. Vui long thu lai sau.',
          });
        }

        if (!turnstileToken) {
          return res.render('pages/login', {
            title: 'Dang nhap - movieCC',
            layout: false,
            error: 'Vui long xac thuc ban la con nguoi',
          });
        }

        if (process.env.TURNSTILE_SECRET_KEY) {
          const verifyForm = new URLSearchParams();
          verifyForm.append('secret', process.env.TURNSTILE_SECRET_KEY);
          verifyForm.append('response', turnstileToken);
          verifyForm.append('remoteip', req.ip || '');

          try {
            const ctrl = new AbortController();
            const tHandle = setTimeout(() => ctrl.abort(), 5000);
            const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
              method: 'POST',
              body: verifyForm,
              signal: ctrl.signal,
            });
            clearTimeout(tHandle);
            const turnstileData = await turnstileRes.json();
            if (!turnstileData.success) {
              logger.warn('security', 'Turnstile reject', {
                ip: req.ip,
                codes: turnstileData['error-codes'],
              });
              return res.render('pages/login', {
                title: 'Dang nhap - movieCC',
                layout: false,
                error: 'Xac minh bi tu choi, vui long thu lai.',
              });
            }
          } catch (err) {
            logger.error('auth', 'Loi Turnstile verify', err);
            // SEC-2: Production fail-closed; dev có thể đi tiếp.
            if (isProd) {
              return res.render('pages/login', {
                title: 'Dang nhap - movieCC',
                layout: false,
                error: 'Khong the xac thuc luc nay. Vui long thu lai sau giay lat.',
              });
            }
          }
        }
      }

      const { username, password, latitude, longitude } = req.body;
      const result = await this.authService.validateCredentials(username, password);

      if (result.valid) {
        const user = result.user;
        return req.session.regenerate((regenErr) => {
          if (regenErr) {
            logger.error(
              'security',
              `Dang nhap that bai (session regenerate): ${username}`,
              { ip: req.ip, userId: user.id, error: regenErr.message },
            );
            return res.render('pages/login', {
              title: 'Dang nhap - movieCC',
              layout: false,
              error: 'Khong the tao phien dang nhap. Vui long thu lai.',
            });
          }

          req.session.user = {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            role: user.role,
            expires_at: user.expires_at || null,
          };

          req.session.save((err) => {
            if (err) {
              logger.error(
                'security',
                `Dang nhap that bai (session save): ${username}`,
                { ip: req.ip, userId: user.id, error: err.message },
              );
              return res.render('pages/login', {
                title: 'Dang nhap - movieCC',
                layout: false,
                error: 'Khong the tao phien dang nhap. Vui long thu lai.',
              });
            }
            logger.info('security', `Dang nhap thanh cong: ${username}`, {
              ip: req.ip,
              userId: user.id,
            });
            this.handlePostLoginAsync(user, req.ip, latitude, longitude);
            res.redirect('/');
          });
        });
      }

      logger.warn('security', `Dang nhap that bai: ${username} (${result.reason})`, {
        ip: req.ip,
      });
      res.render('pages/login', {
        title: 'Dang nhap - movieCC',
        layout: false,
        error: 'Sai tai khoan hoac mat khau',
      });
    } catch (err) {
      logger.error('auth', 'Loi dang nhap', err);
      res.render('pages/login', {
        title: 'Dang nhap - movieCC',
        layout: false,
        error: 'Da xay ra loi, vui long thu lai',
      });
    }
  };

  logout(req, res) {
    const username = req.session.user?.username || 'unknown';
    logger.info('security', `Dang xuat: ${username}`, { ip: req.ip });
    req.session.destroy((err) => {
      if (err) logger.error('auth', 'Session destroy error', err);
      res.redirect('/dang-nhap');
    });
  }

  getProfile = async (req, res) => {
    try {
      const user = await this.authService.getUserById(req.session.user.id);
      res.render('pages/profile', {
        title: 'Ho so - movieCC',
        profileUser: user,
      });
    } catch (err) {
      logger.error('auth', 'Loi trang ho so', err);
      res.redirect(
        '/?msg=' + encodeURIComponent('Khong the tai ho so') + '&msgtype=error',
      );
    }
  };

  updateProfile = async (req, res) => {
    try {
      const errors = validationResult(req);
      const user = await this.authService.getUserById(req.session.user.id);

      if (!errors.isEmpty()) {
        return res.render('pages/profile', {
          title: 'Ho so - movieCC',
          profileUser: user,
          error: errors.array()[0].msg,
        });
      }

      const { display_name, current_password, new_password, confirm_password } = req.body;

      if (new_password) {
        if (!current_password) {
          return res.render('pages/profile', {
            title: 'Ho so - movieCC',
            profileUser: user,
            error: 'Vui long nhap mat khau hien tai',
          });
        }

        const result = await this.authService.validateCredentials(user.username, current_password);
        if (!result.valid) {
          return res.render('pages/profile', {
            title: 'Ho so - movieCC',
            profileUser: user,
            error: 'Mat khau hien tai khong dung',
          });
        }

        if (new_password.length < 6) {
          return res.render('pages/profile', {
            title: 'Ho so - movieCC',
            profileUser: user,
            error: 'Mat khau moi phai co it nhat 6 ky tu',
          });
        }

        if (new_password !== confirm_password) {
          return res.render('pages/profile', {
            title: 'Ho so - movieCC',
            profileUser: user,
            error: 'Mat khau xac nhan khong khop',
          });
        }
      }

      await this.authService.updateProfile(req.session.user.id, { display_name, password: new_password || undefined });

      logger.info(
        'security',
        `Cap nhat ho so: user_${req.session.user.id}${new_password ? ' (credentials_changed)' : ''}`,
        { userId: req.session.user.id },
      );

      req.session.user.display_name = display_name;
      req.session.save((err) => {
        if (err) {
          logger.error('auth', 'Session save error sau cap nhat ho so', err);
          return res.redirect(
            '/ho-so?msg=' +
              encodeURIComponent('Cap nhat thanh cong nhung phien co loi. Vui long dang nhap lai.') +
              '&msgtype=error',
          );
        }
        res.redirect(
          '/ho-so?msg=' +
            encodeURIComponent('Cap nhat ho so thanh cong!') +
            '&msgtype=success',
        );
      });
    } catch (err) {
      logger.error('auth', 'Loi cap nhat ho so', err);
      res.redirect(
        '/ho-so?msg=' +
          encodeURIComponent('Da xay ra loi khi cap nhat') +
          '&msgtype=error',
      );
    }
  };

  handlePostLoginAsync = async (user, ip, lat, lng) => {
    try {
      const sendTelegramMessage = require('../../utils/telegram');
      let locationStr = 'Unknown';
      let realLocation = '';

      if (lat && lng) {
        realLocation = `\n📍 <b>Tọa độ thực:</b> <a href="https://maps.google.com/?q=${lat},${lng}">${lat}, ${lng}</a>`;
      }

      // Lấy vị trí từ IP (nếu không phải localhost)
      if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== '::ffff:127.0.0.1') {
        const ipClean = ip.replace(/^.*:/, ''); // xử lý IPv6 mapped IPv4
        const resp = await fetch(`http://ip-api.com/json/${ipClean}?fields=status,country,city`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'success') {
            locationStr = `${data.city}, ${data.country}`;
          }
        }
      } else {
        locationStr = 'Localhost / Nội bộ';
      }

      // Lưu log chuyên sâu đối với tài khoản admin
      if (user.role === 'admin') {
        const logger = require('../../utils/logger');
        logger.info('security', `Admin [${user.username}] login từ IP: ${ip} - Vị trí: ${locationStr}${lat ? ` - Tọa độ: ${lat},${lng}` : ''}`, {
          ip,
          location: locationStr,
          lat: lat || null,
          lng: lng || null
        });
      }

      // Gửi thông báo Telegram (áp dụng cho mọi user)
      const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const text = `🚨 <b>Thông báo đăng nhập mới</b>
👤 <b>Tài khoản:</b> ${user.username} (<i>${user.role}</i>)
🌐 <b>IP:</b> ${ip}
🌎 <b>Vị trí IP:</b> ${locationStr}${realLocation}
⏰ <b>Thời gian:</b> ${timeStr}`;

      await sendTelegramMessage(text);
    } catch (err) {
      const logger = require('../../utils/logger');
      logger.error('auth', 'Loi handlePostLoginAsync', err);
    }
  };
}

module.exports = AuthController;
