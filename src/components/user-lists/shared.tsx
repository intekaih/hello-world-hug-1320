import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2, LogIn } from "lucide-react";

import {
  useAuthStore,
  selectIsAuthenticated,
  selectIsAuthenticating,
} from "@/store/authStore";
import { transition } from "@/lib/design";
import { cn } from "@/lib/utils";

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
        <LogIn className="h-8 w-8 text-foreground/40" />
        <p className="text-foreground/70">Bạn cần đăng nhập để tiếp tục</p>
        <Link
          to="/login"
          search={{ redirect: target }}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Cinematic header used across every library page. Includes optional eyebrow,
 * subtitle and count line so pages read like a private-cinema chapter card.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  count,
  countLabel,
  icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.hero}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="glass mt-0.5 flex h-12 w-12 items-center justify-center rounded-2xl text-primary shadow-lg shadow-primary/20 ring-1 ring-primary/20">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-muted-foreground md:text-base">{subtitle}</p>
          )}
          {typeof count === "number" && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
              {countLabel ?? `${count}`}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
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
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface-elevated" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-elevated" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-elevated" />
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
      transition={transition.scene}
      className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-foreground/10 px-6 py-24 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 60%)",
        }}
      />
      <div className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-primary/90 ring-1 ring-primary/20">
        {icon}
      </div>
      <div>
        <p className="font-display text-xl font-semibold text-foreground">{title}</p>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {cta && (
        <Link
          to={cta.to}
          className="mt-1 rounded-full bg-gradient-to-r from-primary to-primary/85 px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:shadow-primary/50"
        >
          {cta.label}
        </Link>
      )}
    </motion.div>
  );
}

/**
 * Section header used to introduce a time-bucket or chapter within a library
 * page (Today / This week / Older). Small, quiet, unmistakably cinematic.
 */
export function GroupHeading({
  label,
  count,
  className,
}: {
  label: string;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 mt-2 flex items-center gap-3", className)}>
      <span className="h-px flex-shrink-0 w-6 bg-gradient-to-r from-primary/80 to-transparent" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/80">
        {label}
      </span>
      {typeof count === "number" && (
        <span className="text-[11px] font-medium text-muted-foreground">{count}</span>
      )}
      <span className="h-px flex-1 bg-foreground/5" />
    </div>
  );
}

/** Small pill row for sort / filter choices. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2" role="tablist">
      {children}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={!!active}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        active
          ? "border-primary/50 bg-primary/15 text-foreground shadow-sm shadow-primary/20"
          : "border-foreground/10 bg-surface-elevated/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
