import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2, Sparkles } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import { ShareSheet } from "@/components/share/share-sheet";


/**
 * Share payload — every surface that offers "share" passes one of these.
 * `timestampSeconds` is only meaningful for player shares (adds ?t=).
 */
export type SharePayload = {
  title: string;
  /** Canonical slug — preferred for building /phim/{slug}?ref=share links. */
  slug?: string;
  /** Full url. Overrides slug-based derivation. */
  url?: string;
  /** Optional cover art shown inside the sheet and share card. */
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

  /**
   * Post-share micro-reward — celebratory toast with an optional
   * "add to watchlist" action. Never spams, never contact-book invites.
   */
  const notifyShared = useCallback(
    (p: SharePayload, channel: string) => {
      const canAdd = Boolean(p.slug);
      toast.success(t("share.toast.sharedTitle"), {
        description: t("share.toast.sharedDescription", { channel }),
        icon: <Sparkles className="h-4 w-4 text-primary" />,
        duration: canAdd ? 5000 : 2600,
        action: canAdd
          ? {
              label: t("share.toast.addWatchlist"),
              onClick: async () => {
                try {
                  const res = await fetch("/api/watchlist/toggle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      movie_slug: p.slug,
                      movie_name: p.title,
                      movie_thumb: p.posterUrl,
                    }),
                  });
                  if (res.ok) toast.success(t("share.toast.addedWatchlist"));
                } catch {
                  /* fail silently — never fake success */
                }
              },
            }
          : undefined,
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
        onShared={notifyShared}
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
 * Build the canonical share URL.
 *  · Prefers `/phim/{slug}?ref=share` when a slug is present — the invite
 *    banner keys on `ref=share`, so this attribution must survive channels.
 *  · Falls back to explicit `url` or the current location.
 *  · Appends `?t=` for player timestamp shares.
 */
export function buildShareUrl(p: SharePayload): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://movie.cc";
  const base = p.slug
    ? `${origin}/phim/${p.slug}`
    : p.url ?? (typeof window !== "undefined" ? window.location.href : origin);
  try {
    const u = new URL(base, origin);
    if (p.slug) u.searchParams.set("ref", "share");
    if (p.timestampSeconds && p.timestampSeconds > 0) {
      u.searchParams.set("t", String(Math.floor(p.timestampSeconds)));
    }
    return u.toString();
  } catch {
    // Absolute-worst fallback for exotic base URLs
    const params: string[] = [];
    if (p.slug) params.push("ref=share");
    if (p.timestampSeconds && p.timestampSeconds > 0)
      params.push(`t=${Math.floor(p.timestampSeconds)}`);
    if (!params.length) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}${params.join("&")}`;
  }
}

