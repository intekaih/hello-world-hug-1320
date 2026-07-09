import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCheck, Bell } from "lucide-react";
import { AnimatePresence } from "motion/react";

import {
  NotificationRow,
  useMarkRead,
  useNotifications,
} from "@/components/notifications";
import { NotificationPreferences } from "@/components/notification-preferences";
import {
  EmptyState,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";
import { useTranslation } from "@/hooks/useTranslation";


export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Thông báo — movieCC" },
      { name: "description", content: "Cập nhật mới nhất từ thư viện phim của bạn." },
      { property: "og:title", content: "Thông báo — movieCC" },
      {
        property: "og:description",
        content: "Cập nhật mới nhất từ thư viện phim của bạn.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <NotificationsPage />
    </RequireAuth>
  ),
});

function NotificationsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("notifications.eyebrow")}
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        count={isLoading ? undefined : items.length}
        countLabel={
          isLoading ? undefined : t("notifications.unreadBadge", { n: unread })
        }
        icon={<Bell className="h-5 w-5" />}
        actions={
          unread > 0 && (
            <button
              onClick={() => markRead.mutate({ all: true })}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-foreground/10 bg-surface-elevated px-4 text-sm text-foreground/80 transition hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <CheckCheck className="h-4 w-4" /> {t("notifications.markAllRead")}
            </button>
          )
        }
      />

      <NotificationPreferences />

      {isLoading ? (

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass flex items-start gap-4 rounded-2xl border border-foreground/5 p-3"
            >
              <div className="h-24 w-16 flex-shrink-0 animate-pulse rounded-lg bg-surface-elevated sm:h-28 sm:w-20" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-surface-elevated" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-surface-elevated" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-elevated" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff className="h-8 w-8" />}
          title={t("notifications.empty.title")}
          description={t("notifications.empty.description")}
          cta={{ label: t("notifications.empty.cta"), to: "/" }}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onMarkRead={() => markRead.mutate({ id: n.id })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
