const UserRepository = require('../../modules/auth/repositories/UserRepository');
const AuthService = require('../../modules/auth/services/AuthService');
const AuthController = require('../../modules/auth/authController');

const FavoritesRepository = require('../../modules/favorites/repositories/FavoritesRepository');
const FavoritesService = require('../../modules/favorites/services/FavoritesService');
const FavoritesController = require('../../modules/favorites/FavoritesController');

const HistoryRepository = require('../../modules/history/repositories/HistoryRepository');
const HistoryService = require('../../modules/history/services/HistoryService');
const HistoryController = require('../../modules/history/HistoryController');

const NotificationRepository = require('../../modules/notifications/repositories/NotificationRepository');
const NotificationService = require('../../modules/notifications/services/NotificationService');
const NotificationController = require('../../modules/notifications/NotificationController');

const FeedbackRepository = require('../../modules/feedback/repositories/FeedbackRepository');
const FeedbackService = require('../../modules/feedback/services/FeedbackService');
const FeedbackController = require('../../modules/feedback/FeedbackController');

const AdminRepository = require('../../modules/admin/repositories/AdminRepository');
const AdminService = require('../../modules/admin/services/AdminService');
const AdminController = require('../../modules/admin/AdminController');

// Repositories
const userRepository = new UserRepository();
const favoritesRepository = new FavoritesRepository();
const historyRepository = new HistoryRepository();
const notificationRepository = new NotificationRepository();
const feedbackRepository = new FeedbackRepository();
const adminRepository = new AdminRepository();

// Services
const authService = new AuthService(userRepository);
const favoritesService = new FavoritesService(favoritesRepository);
const historyService = new HistoryService(historyRepository);
const notificationService = new NotificationService(notificationRepository, favoritesRepository);
const feedbackService = new FeedbackService(feedbackRepository);
const adminService = new AdminService(adminRepository);

// Controllers
const authController = new AuthController(authService);
const favoritesController = new FavoritesController(favoritesService);
const historyController = new HistoryController(historyService);
const notificationController = new NotificationController(notificationService);
const feedbackController = new FeedbackController(feedbackService);
const adminController = new AdminController(adminService);

module.exports = {
  userRepository,
  authService,
  authController,
  favoritesRepository,
  favoritesService,
  favoritesController,
  historyRepository,
  historyService,
  historyController,
  notificationRepository,
  notificationService,
  notificationController,
  feedbackRepository,
  feedbackService,
  feedbackController,
  adminRepository,
  adminService,
  adminController,
};
