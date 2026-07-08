import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, Loader2, Lock, User, AlertCircle, Film } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  redirect: fallback(z.string(), "/").default("/"),
});

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập tối thiểu 3 ký tự")
    .max(64, "Tên đăng nhập quá dài"),
  password: z
    .string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
    .max(128, "Mật khẩu quá dài"),
  remember: z.boolean().default(false),
});

type LoginForm = z.input<typeof loginSchema>;

export const Route = createFileRoute("/login")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Đăng nhập — movieCC" },
      { name: "description", content: "Đăng nhập để tiếp tục xem phim yêu thích." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", remember: false },
    mode: "onBlur",
  });

  const { register, handleSubmit, formState } = form;
  const { errors, isSubmitting } = formState;

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        setServerError(data.error ?? "Đăng nhập thất bại. Vui lòng thử lại.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
      navigate({ to: redirect || "/", replace: true });
    } catch {
      setServerError("Không thể kết nối máy chủ. Kiểm tra lại kết nối.");
    }
  };

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100vh-4rem)] md:-mx-6 md:-my-6 lg:-mx-8 lg:-my-8">
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10">
        {/* Ambient background */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-30"
          style={{
            backgroundImage:
              "url(https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg)",
          }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-bg via-bg/90 to-bg" />
        <div
          aria-hidden
          className="absolute -top-40 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong w-full max-w-md rounded-3xl border border-white/10 p-8 shadow-2xl"
        >
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
              <Film className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Chào mừng trở lại</h1>
            <p className="text-sm text-white/60">Đăng nhập để tiếp tục xem phim yêu thích</p>
          </div>

          <AnimatePresence>
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{serverError}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Tên đăng nhập" error={errors.username?.message} icon={<User className="h-4 w-4" />}>
              <input
                {...register("username")}
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="demo"
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-3 text-white placeholder:text-white/30 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                aria-invalid={!!errors.username}
              />
            </Field>

            <Field label="Mật khẩu" error={errors.password?.message} icon={<Lock className="h-4 w-4" />}>
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-11 text-white placeholder:text-white/30 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input
                  {...register("remember")}
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-white/20 bg-black/40 text-primary accent-primary"
                />
                Ghi nhớ đăng nhập
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-primary transition hover:text-primary/80"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-white shadow-lg shadow-primary/30 transition hover:shadow-primary/50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-white/40">
            Demo: <span className="text-white/70">demo / demo1234</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  icon,
  children,
}: {
  label: string;
  error?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white/80">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
          {icon}
        </div>
        {children}
      </div>
      {error && <p className="mt-1.5 text-xs text-primary">{error}</p>}
    </div>
  );
}
