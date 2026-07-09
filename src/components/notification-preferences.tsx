import { Bell, Sparkles, Info } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import {
  useNotifPrefsStore,
  type NotificationChannel,
} from "@/store/notifPrefsStore";
import { cn } from "@/lib/utils";

/**
 * NotificationPreferences — a small settings panel controlling which
 * notification channels the user actually wants to receive. Choices are
 * persisted per-device and applied client-side by the notification hooks.
 * Kept intentionally quiet visually so it never looks like a promo card.
 */
export function NotificationPreferences() {
  const { t } = useTranslation();
  const state = useNotifPrefsStore();

  const rows: {
    key: NotificationChannel;
    icon: typeof Bell;
    title: string;
    desc: string;
  }[] = [
    {
      key: "new_episode",
      icon: Bell,
      title: t("notifications.prefs.new_episode.title"),
      desc: t("notifications.prefs.new_episode.desc"),
    },
    {
      key: "recommendation",
      icon: Sparkles,
      title: t("notifications.prefs.recommendation.title"),
      desc: t("notifications.prefs.recommendation.desc"),
    },
    {
      key: "system",
      icon: Info,
      title: t("notifications.prefs.system.title"),
      desc: t("notifications.prefs.system.desc"),
    },
  ];

  return (
    <section className="glass rounded-2xl border border-foreground/10 p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("notifications.prefs.title")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("notifications.prefs.subtitle")}
        </p>
      </header>
      <ul className="divide-y divide-foreground/5">
        {rows.map(({ key, icon: Icon, title, desc }) => {
          const on = state[key];
          return (
            <li key={key} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={title}
                onClick={() => state.setPref(key, !on)}
                className={cn(
                  "relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  on ? "bg-primary" : "bg-foreground/15",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                    on ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
