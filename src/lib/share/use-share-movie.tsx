import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import { ShareSheet } from "@/components/share/share-sheet";

/**
 * Share payload — every surface that offers "share" passes one of these.
 * `timestampSeconds` is only meaningful for player shares (adds ?t=).
 */
export type SharePayload = {
  title: string;
  /** Full url. If omitted, uses window.location.href. */
  url?: string;
  /** Optional cover art shown inside the sheet. */
  posterUrl?: string;
  /** Optional short description / tagline. */
  description?: string;
  /** Optional playback timestamp — appended as ?t=<seconds>. */
  timestampSeconds?: number;
};

type Ctx = {
  open: (payload: SharePayload) => void;
  isNativeAvailable: boolean;
};

const ShareContext = createContext<Ctx | null>(null);

/**
 * Global provider — mounts a single ShareSheet + toast integration.
 * Every share button just calls `open()` from `useShareMovie()`; no
 * per-surface sheet mounting, no layout shift.
 */
export function ShareProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((p: SharePayload) => {
    setPayload(p);
    setIsOpen(true);
  }, []);

  const isNativeAvailable = useMemo(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    [],
  );

  const notifyCopied = useCallback(
    (title: string) => {
      toast.success(t("share.toast.copiedTitle"), {
        description: t("share.toast.copiedDescription", { title }),
        icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
        duration: 2400,
      });
    },
    [t],
  );

  return (
    <ShareContext.Provider value={{ open, isNativeAvailable }}>
      {children}
      <ShareSheet
        payload={payload}
        open={isOpen}
        onOpenChange={setIsOpen}
        onCopied={notifyCopied}
      />
    </ShareContext.Provider>
  );
}

export function useShareMovie() {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error("useShareMovie must be used inside <ShareProvider>");
  return ctx;
}

/**
 * Build the canonical URL from a payload. Handles ?t= for player shares.
 */
export function buildShareUrl(p: SharePayload): string {
  const base =
    p.url ?? (typeof window !== "undefined" ? window.location.href : "");
  if (p.timestampSeconds == null || p.timestampSeconds <= 0) return base;
  try {
    const u = new URL(base, typeof window !== "undefined" ? window.location.origin : "https://example.com");
    u.searchParams.set("t", String(Math.floor(p.timestampSeconds)));
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}t=${Math.floor(p.timestampSeconds)}`;
  }
}
