/**
 * Auth API client — wraps BE Express endpoints at /api/react/auth/*.
 * All mutating calls are routed through apiFetch, which auto-attaches
 * the CSRF token and credentials cookie.
 */
import { apiGet, apiPost, apiPut, ApiError } from "./base";
import { useAuthStore, type AuthUser } from "@/store/authStore";

export interface BeUser {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  createdAt?: string;
}

export type { AuthUser };

/** Map BE user shape → existing store shape used across the app. */
export function toAuthUser(u: BeUser): AuthUser {
  return {
    id: u.id,
    username: u.username,
    name: u.displayName || u.username,
    avatar_url: "",
  };
}

type LoginRes = { success: boolean; user?: BeUser; error?: string };
type MeRes = { authenticated: boolean; user: BeUser | null };
type RegisterRes = { success: boolean; user?: BeUser; error?: string };
type ProfileRes = { success: boolean; user?: BeUser; error?: string };
type OkRes = { success: boolean; error?: string };

export async function login(
  username: string,
  password: string,
): Promise<BeUser> {
  const data = await apiPost<LoginRes>("/auth/login", { username, password });
  if (!data.success || !data.user) {
    throw new ApiError(401, data.error || "Sai tên đăng nhập hoặc mật khẩu", data);
  }
  useAuthStore.getState().setUser(toAuthUser(data.user));
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await apiPost<OkRes>("/auth/logout");
  } finally {
    useAuthStore.getState().reset();
  }
}

export async function getMe(): Promise<BeUser | null> {
  try {
    const data = await apiGet<MeRes>("/auth/me");
    if (data.authenticated && data.user) {
      useAuthStore.getState().setUser(toAuthUser(data.user));
      return data.user;
    }
    useAuthStore.getState().reset();
    return null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      useAuthStore.getState().reset();
      return null;
    }
    throw err;
  }
}

export async function register(
  username: string,
  password: string,
  displayName?: string,
): Promise<BeUser> {
  const payload: Record<string, string> = { username, password };
  if (displayName) payload.displayName = displayName;
  const data = await apiPost<RegisterRes>("/auth/register", payload);
  if (!data.success || !data.user) {
    throw new ApiError(400, data.error || "Đăng ký thất bại", data);
  }
  // BE sets session cookie on register — hydrate store.
  useAuthStore.getState().setUser(toAuthUser(data.user));
  return data.user;
}

export async function forgotPassword(username: string): Promise<void> {
  // Never leak existence — swallow errors.
  try {
    await apiPost<OkRes>("/auth/forgot-password", { username });
  } catch {
    /* ignore */
  }
}

export async function updateProfile(displayName: string): Promise<BeUser> {
  const data = await apiPut<ProfileRes>("/auth/profile", { displayName });
  if (!data.success || !data.user) {
    throw new ApiError(400, data.error || "Không cập nhật được hồ sơ", data);
  }
  useAuthStore.getState().setUser(toAuthUser(data.user));
  return data.user;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const data = await apiPost<OkRes>("/auth/change-password", {
    currentPassword,
    newPassword,
  });
  if (!data.success) {
    throw new ApiError(400, data.error || "Đổi mật khẩu thất bại", data);
  }
}
