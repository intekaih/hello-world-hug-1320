# Wave 2.2 — Wire Auth (Login / Logout / Me / Register)

## Context

BE exposes 8 auth endpoints. Tất cả cần CSRF token (ngoại trừ GET):

```
POST /api/react/auth/login            { username, password }
POST /api/react/auth/logout
GET  /api/react/auth/me
GET  /api/react/auth/csrf-token        (sets csrf_token cookie + returns {csrfToken})
POST /api/react/auth/register          { username, password, displayName? }
POST /api/react/auth/forgot-password   { username }
PUT  /api/react/auth/profile           { displayName }
POST /api/react/auth/change-password   { currentPassword, newPassword }
```

## Response shapes (xem backend/src/routes/api.js lines 581-722)

### POST /auth/login → 200
```ts
{
  success: true,
  user: {
    id: string,            // MongoDB ObjectId
    username: string,
    displayName: string,
    role: 'user' | 'admin',
    createdAt: string
  }
}
```

### POST /auth/login → 401
```ts
{ success: false, error: "Sai tên đăng nhập hoặc mật khẩu" }
```

### GET /auth/me
```ts
// Logged in:
{ authenticated: true, user: { id, username, displayName, role, ... } }
// Not logged in:
{ authenticated: false, user: null }
```

### POST /auth/register → 201
```ts
{ success: true, user: { id, username, displayName, role }, message: "Đăng ký thành công" }
```

## Tasks

### Task A — Tạo `src/api-client/auth.ts`

```typescript
import { apiFetch, ensureBeCsrfToken } from './base';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
  createdAt?: string;
}

export async function login(username: string, password: string): Promise<User> {
  // 1. ensureBeCsrfToken() (tự cache, idempotent)
  // 2. POST /auth/login with credentials
  // 3. Throw on non-2xx with error message from response.body.error
  // 4. Return response.user
}

export async function logout(): Promise<void> {
  // POST /auth/logout
  // Clear local user cache
}

export async function getMe(): Promise<User | null> {
  // GET /auth/me
  // Return user if authenticated: true, else null
  // Don't throw on 401 — return null
}

export async function register(
  username: string,
  password: string,
  displayName?: string
): Promise<User> {
  // POST /auth/register
  // Auto-login sau khi register thành công
}

export async function forgotPassword(username: string): Promise<void> {
  // POST /auth/forgot-password
  // Always return success (don't leak user existence)
}

export async function updateProfile(displayName: string): Promise<User> {
  // PUT /auth/profile
  // Return updated user
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // POST /auth/change-password
  // Throw on wrong current password
}
```

### Task B — Tạo auth state context `src/lib/auth-context.tsx`

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister, type User } from '@/api-client/auth';

interface AuthContextValue {
  user: User | null;
  status: 'loading' | 'authed' | 'guest';
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'authed' | 'guest'>('loading');

  // On mount: call getMe() to check existing session
  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setStatus(u ? 'authed' : 'guest');
      })
      .catch(() => setStatus('guest'));
  }, []);

  // Login/register/logout wrappers
  // ...

  return <AuthContext.Provider value={...}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

Wrap `<AuthProvider>` around app trong `__root.tsx` (sau các QueryClient + ThemeProvider).

### Task C — Update `src/routes/login.tsx`

```typescript
import { useAuth } from '@/lib/auth-context';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      await login(form.get('username') as string, form.get('password') as string);
      navigate({ to: '/' });
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="username" required />
      <input name="password" type="password" required />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  );
}
```

### Task D — Update `src/routes/profile.tsx`

Show current user info + form to update displayName + form to change password. Use `useAuth()` for current user.

### Task E — Update `src/routes/forgot-password.tsx`

Use `forgotPassword()` API. Show success message regardless of whether user exists.

### Task F — Header avatar/menu

In `src/routes/__root.tsx` (hoặc Header component):
- If `status === 'authed'`: show avatar + dropdown (Profile, Watchlist, History, Logout)
- If `status === 'guest'`: show "Đăng nhập" button
- If `status === 'loading'`: show skeleton

## Acceptance

- [ ] User có thể login thành công → header hiển thị username
- [ ] Logout → header về guest state
- [ ] Reload page sau khi login → vẫn authed (session cookie persist)
- [ ] Register → tự động login luôn
- [ ] CSRF token được tự động gửi cho mọi POST/PUT/DELETE
- [ ] Error từ BE hiển thị đúng tiếng Việt
- [ ] Loading state khi submit form
- [ ] Protected routes (favorites, history, watchlist) check auth status

## Reference

- `backend/src/routes/api.js` lines 581-722 — auth endpoints
- `backend/src/middleware/lovableCsrf.js` — CSRF rules
- `backend/src/database.js` — User model (no email field!)
- `src/api-client/csrf.ts` — đã có `ensureBeCsrfToken()`
- `src/api-client/base.ts` — đã có `apiFetch` + CSRF integration
