# MovieCC Backend

Express.js + MongoDB backend cho MovieCC frontend (Lovable).

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: Session-based + CSRF protection
- **External API**: ophim1.com (phim data source)
- **Security**: bcrypt, helmet, csrf-csrf, express-rate-limit

## API Structure

Tất cả JSON API cho Lovable FE mount tại `/api/react/*`:

| Module | Endpoints |
|--------|-----------|
| **Auth** | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/csrf-token`, `/auth/register`, `/auth/forgot-password`, `/auth/profile` (PUT), `/auth/change-password` |
| **Movies** | `/movies/home`, `/movies/:slug`, `/movies/:slug/episode/:episode`, `/movies/:slug/related`, `/movies/resolve` |
| **Search** | `/search`, `/suggest` |
| **Browse** | `/category/:slug`, `/country/:slug`, `/type/:type`, `/actor/:name`, `/schedule` |
| **Favorites** | `/favorites` (GET), `/favorites/toggle` (POST), `/favorites/check/:slug` |
| **Watchlist** | `/watchlist` (GET), `/watchlist/toggle` (POST), `/watchlist/check/:slug` |
| **History** | `/history` (GET), `/history/progress` (POST), `/history/:id` (DELETE) |
| **Notifications** | `/notifications` (GET), `/notifications/count` (GET), `/notifications/read` (POST) |
| **TMDB** | `/tmdb/tv/:tmdbId` |
| **Translate** | `/translate` (POST) |
| **Feedback** | `/feedback` (POST) |
| **Image Proxy** | `/image/:encoded` |
| **Recommendations** | `/recommendations` (auth required) |

## Cấu trúc thư mục

```
backend/
├── server.js                      # Express app entry
├── build.js                       # Production build script
├── ensure-client-build.js         # Copy client dist → server/public
├── jest.config.js                 # Test config
├── ecosystem.config.js            # PM2 config
├── package.json
├── src/
│   ├── core/                      # Shared core (DI, config, features)
│   ├── config/                    # Provider/source config
│   ├── controllers/               # EJS route controllers
│   ├── database.js                # DB facade (backward compat)
│   ├── middleware/                # auth, csrf, rate limit
│   ├── models/                    # Mongoose models
│   ├── modules/                   # Feature modules (auth, admin, etc.)
│   ├── routes/                    # api.js (React JSON), EJS routes
│   ├── services/                  # Business logic services
│   └── utils/                     # Helpers
├── public/                        # Static assets (built client goes here)
├── scripts/                       # Migration / utility scripts
├── tests/                         # Jest tests
└── data/                          # Local data files (gitignored)
```

## Environment Variables

Xem `.env.example`. Cần:

```env
MONGODB_URI=mongodb://localhost:27017/moviecc
SESSION_SECRET=random-min-32-chars
ENCRYPT_KEY=random-32-chars
OPHIM_BASE_URL=https://ophim1.com
NODE_ENV=production
PORT=3000
REACT_ALLOWED_ORIGINS=https://hello-world-hug-1320.lovable.app
```

## Run Locally

```bash
cd backend
npm install
cp .env.example .env  # điền MONGODB_URI và secrets
npm run dev           # Auto-reload
```

Server chạy tại `http://localhost:3000`.

## Lovable FE Integration

Lovable FE sử dụng:

- **Base URL**: `VITE_API_BASE_URL` env (default `http://localhost:3000`)
- **Auth**: Session cookie (httpOnly, sameSite=lax)
- **CSRF**: Double-submit cookie pattern
  - Cookie name: `csrf_token`
  - Header name: `X-CSRF-Token`
  - Lấy token qua `GET /api/react/auth/csrf-token`
- **CORS**: Pre-configured cho Lovable dev (`localhost:5173`) và prod (`*.lovable.app`)

## Response Format

### Success
```json
{ "success": true, "data": {...} }
```

### Error
```json
{ "success": false, "error": "Thông báo lỗi tiếng Việt" }
```

### List response
```json
{ "items": [...], "totalPages": 5, "currentPage": 1 }
```

## CSRF Pattern (Lovable double-submit)

```typescript
// 1. Fetch CSRF token (cookie tự động được set)
const res = await fetch(`${API_BASE}/api/react/auth/csrf-token`, {
  credentials: 'include',
});
const { csrfToken } = await res.json();

// 2. Dùng token cho POST/PUT/DELETE
await fetch(`${API_BASE}/api/react/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({ username, password }),
});
```

## Test

```bash
npm test
```
