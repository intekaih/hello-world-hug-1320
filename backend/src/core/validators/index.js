/**
 * Express Validator Setup
 *
 * Provides centralized request validation for all routes.
 * Uses express-validator for schema validation.
 *
 * Usage in routes:
 *   const { validate, query, body, param } = require('../validators');
 *   router.post('/movies', validate([
 *     body('slug').isString().trim().notEmpty(),
 *     body('name').isString().trim().notEmpty(),
 *   ]), controller);
 */

const { body, query, param, validationResult } = require('express-validator');

/**
 * Middleware to check validation results
 * Returns 400 with errors if validation failed
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

// ── Movie validators ───────────────────────────────────────────────────────────

const movie = {
  /**
   * Validate movie slug parameter
   */
  slug: [param('slug').isString().trim().notEmpty().withMessage('Slug is required')],
  
  /**
   * Validate episode slug parameter
   */
  episode: [param('episode').isString().trim().notEmpty().withMessage('Episode is required')],
  
  /**
   * Validate search query
   */
  search: [
    query('q').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Query must be 2-200 characters'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  ],

  /**
   * Validate category slug
   */
  category: [
    param('slug').isString().trim().notEmpty().withMessage('Category slug is required'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  ],
};

// ── Auth validators ───────────────────────────────────────────────────────────

const auth = {
  /**
   * Validate login credentials
   */
  login: [
    body('username').isString().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('password').isString().isLength({ min: 4, max: 100 }).withMessage('Password is required'),
  ],

  /**
   * Validate registration (if needed)
   */
  register: [
    body('username').isString().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('password').isString().isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters'),
    body('display_name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Display name is required'),
  ],
};

// ── Favorites validators ───────────────────────────────────────────────────────

const favorites = {
  toggle: [
    body('movieSlug').isString().trim().notEmpty().withMessage('Movie slug is required'),
    body('movieName').isString().trim().notEmpty().withMessage('Movie name is required'),
    body('movieThumb').isString().trim().notEmpty().withMessage('Movie thumb is required'),
    body('movieOriginName').isString().trim().notEmpty().withMessage('Movie origin name is required'),
    body('lastEpisode').isString().trim().notEmpty().withMessage('Last episode is required'),
  ],

  check: [
    param('slug').isString().trim().notEmpty().withMessage('Slug is required'),
  ],
};

// ── History validators ─────────────────────────────────────────────────────────

const history = {
  saveProgress: [
    body('movieSlug').isString().trim().notEmpty().withMessage('Movie slug is required'),
    body('episodeSlug').isString().trim().notEmpty().withMessage('Episode slug is required'),
    body('currentTime').isNumeric().toInt().withMessage('Current time must be a number'),
    body('duration').isNumeric().toInt().withMessage('Duration must be a number'),
    body('movieName').isString().trim().notEmpty().withMessage('Movie name is required'),
    body('movieThumb').isString().trim().notEmpty().withMessage('Movie thumb is required'),
  ],

  getProgress: [
    param('slug').isString().trim().notEmpty().withMessage('Slug is required'),
    param('episode').isString().trim().notEmpty().withMessage('Episode is required'),
  ],

  delete: [
    param('id').isString().trim().notEmpty().withMessage('ID is required'),
  ],
};

// ── Notifications validators ────────────────────────────────────────────────────

const notifications = {
  markRead: [
    param('id').isString().trim().notEmpty().withMessage('ID is required'),
  ],
};

// ── Watchlist validators ────────────────────────────────────────────────────────

const watchlist = {
  toggle: [
    body('movieSlug').isString().trim().notEmpty().withMessage('Movie slug is required'),
    body('movieName').isString().trim().notEmpty().withMessage('Movie name is required'),
    body('movieThumb').isString().trim().notEmpty().withMessage('Movie thumb is required'),
    body('movieOriginName').isString().trim().notEmpty().withMessage('Movie origin name is required'),
    body('lastEpisode').isString().trim().notEmpty().withMessage('Last episode is required'),
  ],

  check: [
    param('slug').isString().trim().notEmpty().withMessage('Slug is required'),
  ],
};

// ── Feedback validators ────────────────────────────────────────────────────────

const feedback = {
  submit: [
    body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100 chars)'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('category').isString().trim().notEmpty().withMessage('Category is required'),
    body('message').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('Message must be 10-5000 characters'),
    body('movieSlug').optional().isString().trim(),
  ],
};

// ── Translate validators ────────────────────────────────────────────────────────

const translate = {
  translate: [
    body('text').isString().trim().isLength({ min: 1, max: 10000 }).withMessage('Text is required (max 10000 chars)'),
    body('targetLang').optional().isString().trim().isLength({ min: 2, max: 10 }),
    body('movieSlug').optional().isString().trim(),
  ],
};

module.exports = {
  validate,
  query,
  body,
  param,
  movie,
  auth,
  favorites,
  history,
  notifications,
  watchlist,
  feedback,
  translate,
};
