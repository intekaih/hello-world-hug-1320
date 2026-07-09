/**
 * Feature Flags Configuration
 * 
 * Cách sử dụng:
 * 1. Mỗi flag kiểm soát một module mới được tách trong /modules/
 * 2. Flag = false → dùng legacy code trong /controllers/ và /database/
 * 3. Flag = true → dùng code mới trong /modules/ với DI container
 * 
 * Quy trình enable flag:
 * 1. Implement module mới trong /modules/
 * 2. Set flag = false → 100% traffic dùng code CŨ
 * 3. Set flag = true cho 10% → monitor 24h
 * 4. OK → flag = true cho 50% → monitor 12h
 * 5. OK → flag = true cho 100%
 * 6. 1 tuần stable → xóa legacy code
 * 
 * Environment variables (set trong .env):
 *   FEATURE_NEW_AUTH=true|false
 *   FEATURE_NEW_FAVORITES=true|false
 *   FEATURE_NEW_HISTORY=true|false
 *   FEATURE_NEW_NOTIFICATIONS=true|false
 *   FEATURE_NEW_MOVIES=true|false
 *   FEATURE_NEW_FEEDBACK=true|false
 *   FEATURE_NEW_ADMIN=true|false
 */

/**
 * @property {boolean} useNewAuthModule
 *   Auth module mới dùng DI container
 *   Default: false (dùng legacy auth trong database.js)
 */
module.exports = {
  useNewAuthModule: process.env.FEATURE_NEW_AUTH === 'true',
  
  /**
   * @property {boolean} useNewFavoritesModule
   *   Favorites module mới với repository pattern
   *   Default: false (dùng legacy trong database.js)
   */
  useNewFavoritesModule: process.env.FEATURE_NEW_FAVORITES !== 'false',
  
  /**
   * @property {boolean} useNewHistoryModule
   *   Watch history module mới với repository pattern
   *   Default: false (dùng legacy trong database.js)
   */
  useNewHistoryModule: process.env.FEATURE_NEW_HISTORY !== 'false',
  
  /**
   * @property {boolean} useNewNotificationsModule
   *   Notifications module mới với repository pattern
   *   Default: false (dùng legacy trong database.js)
   */
  useNewNotificationsModule: process.env.FEATURE_NEW_NOTIFICATIONS !== 'false',
  
  /**
   * @property {boolean} useNewMoviesModule
   *   Movies module mới (đang phát triển)
   *   Default: false
   */
  useNewMoviesModule: process.env.FEATURE_NEW_MOVIES === 'true',
  
  /**
   * @property {boolean} useNewFeedbackModule
   *   Feedback module mới với repository pattern
   *   Default: false (dùng legacy trong database.js)
   */
  useNewFeedbackModule: process.env.FEATURE_NEW_FEEDBACK !== 'false',
  
  /**
   * @property {boolean} useNewAdminModule
   *   Admin module mới (dashboard, analytics)
   *   Default: false (dùng legacy trong controllers/adminController.js)
   */
  useNewAdminModule: process.env.FEATURE_NEW_ADMIN === 'true',
};
