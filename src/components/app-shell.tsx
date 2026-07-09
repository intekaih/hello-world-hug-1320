import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Bell,
  Bookmark,
  CalendarClock,
  Compass,
  Heart,
  History,
  Home,
  Menu,
  PanelLeft,
  Moon,
  Search,
  Sun,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/themeStore";
import { useTranslation } from "@/hooks/useTranslation";
import { MegaMenu } from "@/components/header/mega-menu";

type NavItem = {
  labelKey: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

const sidebarItems: NavItem[] = [
  { labelKey: "nav.home", to: "/", icon: Home },
  { labelKey: "nav.discover", to: "/kham-pha", icon: Compass },
  { labelKey: "nav.schedule", to: "/lich-chieu", icon: CalendarClock },
  
  { labelKey: "nav.history", to: "/history", icon: History },
  { labelKey: "nav.favorites", to: "/favorites", icon: Heart },
  { labelKey: "nav.watchlist", to: "/watchlist", icon: Bookmark },
  { labelKey: "nav.notifications", to: "/notifications", icon: Bell },
  { labelKey: "nav.profile", to: "/profile", icon: User },
];

const mobileTabs: NavItem[] = [
  { labelKey: "nav.home", to: "/", icon: Home },
  { labelKey: "nav.search", to: "/search", icon: Search },
  { labelKey: "nav.history", to: "/history", icon: History },
  { labelKey: "nav.favorites", to: "/favorites", icon: Heart },
  { labelKey: "nav.profile", to: "/profile", icon: User },
];

function useIsActive(to: string) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function useTheme() {
  const resolved = useThemeStore((s) => s.resolved);
  const isDark = resolved === "dark";
  const toggle = useThemeStore((s) => s.toggle);
  const syncResolved = useThemeStore((s) => s.syncResolved);
  const pref = useThemeStore((s) => s.isDark);

  // Apply html.dark class + listen for OS-level scheme changes.
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (pref === null) syncResolved();
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [pref, syncResolved]);

  return { isDark, toggle };
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed?: boolean }) {
  const active = useIsActive(item.to);
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(item.labelKey);

  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "text-primary" : "text-foreground-muted hover:text-foreground",
      )}
    >
      {active && (
        <>
          <motion.span
            layoutId="sidebar-pill"
            className="absolute inset-0 rounded-xl bg-primary/12"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
          <motion.span
            layoutId="sidebar-rail"
            className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary shadow-[0_0_12px_var(--color-primary)]"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        </>
      )}
      <Icon className="relative h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" aria-hidden />
      {!collapsed && <span className="relative truncate">{label}</span>}
    </Link>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="group relative flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl">
        <span aria-hidden className="absolute inset-0 bg-[var(--gradient-ember)]" />
        <span aria-hidden className="absolute inset-0 opacity-70 mix-blend-overlay [background:conic-gradient(from_140deg,oklch(0.78_0.18_55/0.9),transparent_60%,oklch(0.55_0.2_300/0.6))]" />
        <span aria-hidden className="grain-strong rounded-xl" />
        <span className="relative font-display text-[19px] font-semibold italic text-white [font-variation-settings:'opsz'_144,'SOFT'_60] [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
          m
        </span>
      </span>
      {!compact && (
        <span className="flex items-baseline gap-[1px] leading-none">
          <span className="font-display text-[19px] font-medium italic tracking-[-0.03em] text-foreground [font-variation-settings:'opsz'_144,'SOFT'_50]">
            movie
          </span>
          <span
            className="font-display text-[19px] font-semibold italic tracking-[-0.04em] [font-variation-settings:'opsz'_144,'SOFT'_80]"
            style={{
              background: "var(--gradient-ember)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            cc
          </span>
          <span aria-hidden className="ml-0.5 h-1 w-1 rounded-full bg-primary ambient-pulse" />
        </span>
      )}
    </Link>
  );
}

function SidebarPanel({
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className={cn("flex items-center px-2", collapsed ? "flex-col gap-3" : "justify-between gap-2")}>
        <Brand compact={collapsed} />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {sidebarItems.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>
      {onToggle && (
        <div className={cn("mt-auto border-t border-foreground/10 pt-3", collapsed ? "flex justify-center" : "px-1")}>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn(
              "text-foreground-subtle hover:bg-surface-elevated hover:text-foreground",
              collapsed ? "h-9 w-9 rounded-lg" : "w-full justify-start gap-2 rounded-lg",
            )}
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Collapse</span>}
          </Button>
        </div>
      )}
    </div>
  );
}

function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { isDark, toggle } = useTheme();
  const { t } = useTranslation();

  return (
    <header className="glass-strong sticky top-0 z-40 pt-safe-top">
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        {onOpenMenu && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onOpenMenu}
            aria-label={t("nav.home")}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <div className="md:hidden">
          <Brand compact />
        </div>

        <MegaMenu />

        <div className="flex flex-1 items-center justify-between gap-2 sm:gap-3">
          <div className="relative w-full max-w-md md:ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" />
            <Input
              type="search"
              placeholder={t("nav.search")}
              aria-label={t("nav.search")}
              className="h-10 rounded-full border-foreground/10 bg-surface-elevated pl-10 text-sm placeholder:text-foreground-subtle focus-visible:ring-primary/40"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={isDark ? "Light mode" : "Dark mode"}
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <NotificationBell />

            <AuthHeaderSlot />
          </div>
        </div>
      </div>
    </header>
  );
}

function AuthHeaderSlot() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return (
      <div className="ml-1 h-9 w-9 animate-pulse rounded-full bg-foreground/10" />
    );
  }
  if (!user) {
    return (
      <Link
        to="/login"
        className="ml-1 rounded-full border border-foreground/15 px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:border-primary/60 hover:text-foreground"
      >
        Đăng nhập
      </Link>
    );
  }
  const initials =
    (user.name || user.username || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase())
      .join("") || "?";
  return (
    <Link to="/profile" aria-label="Hồ sơ" className="ml-1">
      <Avatar className="h-9 w-9 ring-2 ring-white/10 transition hover:ring-primary/50">
        <AvatarImage src={user.avatar_url || ""} alt={user.name} />
        <AvatarFallback className="bg-primary/20 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
}


function BottomTabBar() {
  return (
    <nav className="glass-strong fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 pb-safe-bottom md:hidden">
      <ul className="grid grid-cols-5">
        {mobileTabs.map((item) => (
          <li key={item.to}>
            <MobileTab item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MobileTab({ item }: { item: NavItem }) {
  const active = useIsActive(item.to);
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <Link
      to={item.to}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-foreground-subtle hover:text-foreground",
      )}
      aria-label={label}
    >
      <span className="relative grid h-8 w-12 place-items-center rounded-full">
        {active && (
          <motion.span
            layoutId="mobile-pill"
            className="absolute inset-0 rounded-full bg-primary/15"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}
        <Icon className="relative h-5 w-5" aria-hidden />
      </span>
      <span>{label}</span>
    </Link>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel so keyboard users start inside the dialog
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Đóng menu"
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Menu chính"
        className={cn(
          "glass-strong absolute inset-y-0 left-0 w-72 max-w-[85vw] transition-transform duration-300 pt-safe-top pb-safe-bottom",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div onClick={onClose}>
          <SidebarPanel />
        </div>
      </aside>
    </div>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Immersive routes (video watch, etc.) render without sidebar/header/tabbar.
  if (pathname.startsWith("/xem/")) {
    return (
      <div className="dark min-h-dvh bg-background text-foreground">
        <Outlet />
      </div>
    );
  }


  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Desktop + tablet sidebar (>=768px), collapsible */}
      <aside
        className={cn(
          "glass-strong fixed inset-y-0 left-0 z-30 hidden border-r border-foreground/5 transition-[width] duration-300 md:block",
          sidebarCollapsed ? "w-[76px]" : "w-[260px]",
        )}
      >
        <SidebarPanel
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[padding] duration-300",
          sidebarCollapsed ? "md:pl-[76px]" : "md:pl-[260px]",
        )}
      >

        <TopBar onOpenMenu={() => setDrawerOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 pb-24 pt-4 focus:outline-none sm:px-6 md:pb-8 lg:px-8">
          <Outlet />
        </main>
      </div>

      <BottomTabBar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
