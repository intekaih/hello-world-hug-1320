import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  Compass,
  Heart,
  History,
  Home,
  Menu,
  Moon,
  Search,
  Sun,
  User,
  X,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

const sidebarItems: NavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "Browse", to: "/browse", icon: Compass },
  { label: "History", to: "/history", icon: History },
  { label: "Favorites", to: "/favorites", icon: Heart },
  { label: "Watchlist", to: "/watchlist", icon: Bookmark },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Profile", to: "/profile", icon: User },
];

const mobileTabs: NavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "Search", to: "/search", icon: Search },
  { label: "History", to: "/history", icon: History },
  { label: "Favorites", to: "/favorites", icon: Heart },
  { label: "Profile", to: "/profile", icon: User },
];

function useIsActive(to: string) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function useTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed?: boolean }) {
  const active = useIsActive(item.to);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-primary/15 text-primary"
          : "text-foreground-muted hover:bg-white/5 hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow-primary)]">
        <span className="font-display text-lg font-bold">S</span>
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight">
          Stream
        </span>
      )}
    </Link>
  );
}

function SidebarPanel({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2">
        <Brand compact={collapsed} />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {sidebarItems.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>
      {!collapsed && (
        <div className="glass rounded-2xl p-4">
          <p className="font-display text-sm font-semibold">Go Premium</p>
          <p className="mt-1 text-xs text-foreground-subtle">
            Unlock 4K & ad-free streaming.
          </p>
          <Button size="sm" className="mt-3 w-full">
            Upgrade
          </Button>
        </div>
      )}
    </div>
  );
}

function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { isDark, toggle } = useTheme();

  return (
    <header className="glass-strong sticky top-0 z-40 pt-safe-top">
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        {onOpenMenu && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onOpenMenu}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <div className="md:hidden">
          <Brand compact />
        </div>

        <div className="relative ml-auto max-w-md flex-1 md:ml-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" />
          <Input
            type="search"
            placeholder="Search movies, shows, actors…"
            className="h-10 rounded-full border-white/10 bg-white/5 pl-10 text-sm placeholder:text-foreground-subtle focus-visible:ring-primary/40"
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <Link
            to="/notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
              3
            </Badge>
          </Link>

          <Link to="/profile" aria-label="Profile" className="ml-1">
            <Avatar className="h-9 w-9 ring-2 ring-white/10 transition hover:ring-primary/50">
              <AvatarImage src="" alt="You" />
              <AvatarFallback className="bg-primary/20 text-primary">
                YO
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomTabBar() {
  return (
    <nav className="glass-strong fixed inset-x-0 bottom-0 z-40 border-t border-white/5 pb-safe-bottom md:hidden">
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
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-foreground-subtle hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-12 place-items-center rounded-full transition-colors",
          active && "bg-primary/15",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
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
            aria-label="Close menu"
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar (>=1024px) */}
      <aside className="glass-strong fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-white/5 lg:block">
        <SidebarPanel />
      </aside>

      {/* Tablet sidebar (768-1023px), collapsible */}
      <aside
        className={cn(
          "glass-strong fixed inset-y-0 left-0 z-30 hidden border-r border-white/5 transition-[width] duration-300 md:block lg:hidden",
          sidebarCollapsed ? "w-[76px]" : "w-[240px]",
        )}
      >
        <SidebarPanel collapsed={sidebarCollapsed} />
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-4 top-20 hidden h-8 w-8 rounded-full border border-white/10 bg-surface-elevated md:inline-flex"
          onClick={() => setSidebarCollapsed((v) => !v)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </aside>

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300",
          "lg:pl-[260px]",
          sidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]",
          "lg:!pl-[260px]",
        )}
      >
        <TopBar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 md:pb-8 lg:px-8">
          <Outlet />
        </main>
      </div>

      <BottomTabBar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
