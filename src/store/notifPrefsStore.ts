import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Notification } from "@/components/notifications";

export type NotificationChannel = Notification["type"];

/**
 * User-controlled notification preferences.
 *
 * Defaults are opinionated: episode drops are useful signal (ON), the rec
 * feed can feel like noise (OFF), system messages stay ON because they
 * cover account/security/product updates the user needs to see.
 * Persisted per-device in localStorage.
 */
type NotifPrefsState = {
  new_episode: boolean;
  recommendation: boolean;
  system: boolean;
  setPref: (channel: NotificationChannel, on: boolean) => void;
};

export const useNotifPrefsStore = create<NotifPrefsState>()(
  persist(
    (set) => ({
      new_episode: true,
      recommendation: false,
      system: true,
      setPref: (channel, on) => set({ [channel]: on } as Partial<NotifPrefsState>),
    }),
    {
      name: "notif.prefs.v1",
      partialize: (s) => ({
        new_episode: s.new_episode,
        recommendation: s.recommendation,
        system: s.system,
      }),
    },
  ),
);
