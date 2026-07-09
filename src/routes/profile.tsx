import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, LogOut, Save, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { RequireAuth, PageHeader } from "@/components/user-lists/shared";
import { LibrarySummary } from "@/components/library-summary";
import { useAuthStore } from "@/store/authStore";
import { apiPost } from "@/api-client";
import { useTranslation } from "@/hooks/useTranslation";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ — movieCC" },
      { name: "description", content: "Quản lý tài khoản và mật khẩu của bạn." },
      { property: "og:title", content: "Hồ sơ — movieCC" },
      { property: "og:description", content: "Quản lý tài khoản và mật khẩu của bạn." },
      { property: "og:type", content: "profile" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
});

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const qc = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState(user?.avatar_url ?? "");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const saveProfile = useMutation({
    mutationFn: () =>
      apiPost("/api/auth/update-profile", { json: { name, avatar_url: avatar } }),
    onSuccess: () => {
      toast.success("Đã cập nhật hồ sơ");
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      if (user) useAuthStore.getState().setUser({ ...user, name, avatar_url: avatar });
    },
    onError: () => toast.error("Không lưu được. Vui lòng thử lại."),
  });

  const changePw = useMutation({
    mutationFn: () =>
      apiPost("/api/auth/change-password", {
        json: { old_password: oldPw, new_password: newPw },
      }),
    onSuccess: () => {
      toast.success("Đã đổi mật khẩu");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: () => toast.error("Đổi mật khẩu thất bại"),
  });

  const logout = useMutation({
    mutationFn: () => apiPost("/api/auth/logout"),
    onSettled: () => {
      reset();
      qc.clear();
      window.location.href = "/";
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hồ sơ"
        icon={<UserIcon className="h-5 w-5" />}
        actions={
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-1.5 rounded-full border border-foreground/10 bg-surface-elevated px-4 py-2 text-sm text-foreground/80 transition hover:border-destructive/60 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Đăng xuất
          </button>
        }
      />

      <section className="glass rounded-2xl border border-foreground/10 p-6">
        <div className="flex items-center gap-4">
          <img
            src={avatar || "/placeholder.svg"}
            alt={name}
            className="h-20 w-20 rounded-full border border-foreground/10 object-cover"
          />
          <div>
            <div className="text-lg font-semibold text-foreground">{user?.name}</div>
            <div className="text-sm text-muted-foreground">@{user?.username}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Tên hiển thị">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-glass"
            />
          </Field>
          <Field label="Ảnh đại diện (URL)">
            <input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="input-glass"
              placeholder="https://..."
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Lưu thay đổi
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl border border-foreground/10 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <KeyRound className="h-5 w-5 text-primary" /> Đổi mật khẩu
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mật khẩu cũ">
            <input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              className="input-glass"
            />
          </Field>
          <Field label="Mật khẩu mới">
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="input-glass"
            />
          </Field>
          <Field label="Nhập lại">
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="input-glass"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => {
              if (newPw !== confirmPw) {
                toast.error("Mật khẩu xác nhận không khớp");
                return;
              }
              if (newPw.length < 6) {
                toast.error("Mật khẩu tối thiểu 6 ký tự");
                return;
              }
              changePw.mutate();
            }}
            disabled={changePw.isPending || !oldPw || !newPw}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            Đổi mật khẩu
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
