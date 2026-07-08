import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Loader2, Mail, AlertCircle, CheckCircle2, Film } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Tối thiểu 3 ký tự")
    .max(255, "Quá dài"),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Quên mật khẩu — movieCC" },
      { name: "description", content: "Đặt lại mật khẩu tài khoản movieCC." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "" },
    mode: "onBlur",
  });

  const { errors, isSubmitting } = formState;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        setServerError(data.error ?? "Không thể xử lý yêu cầu.");
        return;
      }
      setSent(true);
    } catch {
      setServerError("Không thể kết nối máy chủ.");
    }
  };

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100vh-4rem)] md:-mx-6 md:-my-6 lg:-mx-8 lg:-my-8">
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url(https://image.tmdb.org/t/p/original/pbrkL804c8yAv3zBZR4QPEafpAR.jpg)",
          }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-bg via-bg/90 to-bg" />
        <div
          aria-hidden
          className="absolute -top-40 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong w-full max-w-md rounded-3xl border border-white/10 p-8 shadow-2xl"
        >
          <Link
            to="/login"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
          </Link>

          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary">
              <Film className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Quên mật khẩu?</h1>
            <p className="text-sm text-white/60">
              Nhập email hoặc tên đăng nhập, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20">
                  <CheckCircle2 className="h-7 w-7 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-white">Đã gửi yêu cầu</p>
                  <p className="mt-1 text-sm text-white/60">
                    Nếu <span className="text-white">{getValues("identifier")}</span> tồn tại trong hệ thống,
                    chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Kiểm tra hộp thư của bạn.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-white shadow-lg shadow-primary/30 transition"
                >
                  Về trang đăng nhập
                </Link>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/80">
                    Email hoặc tên đăng nhập
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      {...register("identifier")}
                      type="text"
                      autoFocus
                      autoComplete="username"
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-3 text-white placeholder:text-white/30 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                      aria-invalid={!!errors.identifier}
                    />
                  </div>
                  {errors.identifier && (
                    <p className="mt-1.5 text-xs text-primary">{errors.identifier.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-white shadow-lg shadow-primary/30 transition hover:shadow-primary/50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    "Gửi yêu cầu"
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
