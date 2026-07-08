import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2, LogIn } from "lucide-react";

import {
  useAuthStore,
  selectIsAuthenticated,
  selectIsAuthenticating,
} from "@/store/authStore";

/** Backwards-compat shim: returns a shape close to the old React Query result. */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticating = useAuthStore(selectIsAuthenticating);
  return {
    data: { user },
    isLoading: isAuthenticating,
    isAuthenticated: !!user,
  };
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticating = useAuthStore(selectIsAuthenticating);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isAuthenticating) return;
    if (isAuthenticated) return;
    if (pathname === "/login" || pathname.startsWith("/login")) return;
    navigate({ to: "/login", search: { redirect: pathname }, replace: true });
  }, [isAuthenticating, isAuthenticated, navigate, pathname]);

  if (isAuthenticating) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) {
    const target = pathname.startsWith("/login") ? "/" : pathname;
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <LogIn className="h-8 w-8 text-white/40" />
        <p className="text-white/70">Bạn cần đăng nhập để tiếp tục</p>
        <Link
          to="/login"
          search={{ redirect: target }}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}


export function PageHeader({
  title,
  count,
  icon,
  actions,
}: {
  title: string;
  count?: number;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/80 to-accent/60 text-white shadow-lg shadow-primary/30">
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
          {typeof count === "number" && (
            <p className="text-sm text-muted-foreground">{count} phim</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function MovieGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </div>
  );
}

export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <MovieGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </MovieGrid>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; to: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-20 text-center"
    >
      <div className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {cta && (
        <Link
          to={cta.to}
          className="mt-2 rounded-full bg-gradient-to-r from-primary to-primary/80 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:shadow-primary/50"
        >
          {cta.label}
        </Link>
      )}
    </motion.div>
  );
}
