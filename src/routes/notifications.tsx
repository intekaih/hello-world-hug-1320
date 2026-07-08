import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCheck, Bell } from "lucide-react";
import { AnimatePresence } from "motion/react";

import {
  NotificationRow,
  useMarkRead,
  useNotifications,
} from "@/components/notifications";
import {
  EmptyState,
  PageHeader,
  RequireAuth,
} from "@/components/user-lists/shared";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Thông báo — movieCC" },
      { name: "description", content: "Các cập nhật mới nhất về phim của bạn." },
      { property: "og:title", content: "Thông báo — movieCC" },
      { property: "og:description", content: "Các cập nhật mới nhất về phim của bạn." },
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
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Thông báo"
        count={isLoading ? undefined : items.length}
        icon={<Bell className="h-5 w-5" />}
        actions={
          unread > 0 && (
            <button
              onClick={() => markRead.mutate({ all: true })}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-primary/50 hover:text-white"
            >
              <CheckCheck className="h-4 w-4" /> Đọc tất cả
            </button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass flex items-start gap-4 rounded-2xl border border-white/5 p-3"
            >
              <div className="h-24 w-16 flex-shrink-0 animate-pulse rounded-lg bg-white/5 sm:h-28 sm:w-20" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff className="h-8 w-8" />}
          title="Chưa có thông báo nào"
          description="Các thông báo về tập mới, phim gợi ý sẽ xuất hiện ở đây."
          cta={{ label: "Khám phá phim", to: "/" }}
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
