import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  Copy,
  Facebook,
  Link2,
  Mail,
  MessageCircle,
  Send,
  Share2,
  Twitter,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/design";
import { thumbSrc } from "@/utils/thumbSrc";
import { buildShareUrl, type SharePayload } from "@/lib/share/use-share-movie";

type Props = {
  payload: SharePayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopied: (title: string) => void;
  /** Fired when the user completes a share via a channel (window opened). */
  onShared?: (payload: SharePayload, channel: string) => void;
};

type Channel = {
  key: string;
  label: string;
  icon: typeof Facebook;
  href: (url: string, text: string, title: string) => string;
  /** small tint for the icon halo */
  tint: string;
};


/** Deterministic message picker so the same movie surfaces the same line. */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ShareSheet({ payload, open, onOpenChange, onCopied, onShared }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Reset copied glow when payload changes / sheet closes.
  useEffect(() => {
    if (!open) setCopiedKey(null);
  }, [open]);

  const url = useMemo(() => (payload ? buildShareUrl(payload) : ""), [payload]);
  const emotionalMessage = useMemo(() => {
    if (!payload) return "";
    const messages = [
      t("share.messages.one"),
      t("share.messages.two"),
      t("share.messages.three"),
      t("share.messages.four"),
    ];
    return messages[hash(payload.title) % messages.length];
  }, [payload, t]);

  const shareText = payload ? `${emotionalMessage} — ${payload.title}` : "";

  const channels: Channel[] = useMemo(
    () => [
      {
        key: "facebook",
        label: "Facebook",
        icon: Facebook,
        tint: "text-[#1877F2]",
        href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
      },
      {
        key: "messenger",
        label: "Messenger",
        icon: MessageCircle,
        tint: "text-[#0084FF]",
        href: (u) => `fb-messenger://share/?link=${encodeURIComponent(u)}`,
      },
      {
        key: "telegram",
        label: "Telegram",
        icon: Send,
        tint: "text-[#229ED9]",
        href: (u, txt) =>
          `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(txt)}`,
      },
      {
        key: "twitter",
        label: "X",
        icon: Twitter,
        tint: "text-foreground",
        href: (u, txt) =>
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(txt)}`,
      },
      {
        key: "whatsapp",
        label: "WhatsApp",
        icon: MessageCircle,
        tint: "text-[#25D366]",
        href: (u, txt) => `https://wa.me/?text=${encodeURIComponent(`${txt} ${u}`)}`,
      },
      {
        key: "email",
        label: "Email",
        icon: Mail,
        tint: "text-foreground-muted",
        href: (u, txt, title) =>
          `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${txt}\n${u}`)}`,
      },
    ],
    [],
  );

  const doCopy = async (text: string, key: string) => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onCopied(payload.title);
      window.setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      toast.error(t("share.toast.copyFailed"));
    }
  };

  const openChannel = (c: Channel) => {
    if (!payload) return;
    const href = c.href(url, shareText, payload.title);
    try {
      const w = window.open(href, "_blank", "noopener,noreferrer");
      if (!w && c.key === "messenger") {
        // Deep link failed — copy link as consolation.
        void doCopy(url, "messenger");
      }
      onShared?.(payload, c.label);
    } catch {
      void doCopy(url, c.key);
    }
    onOpenChange(false);
  };


  if (!payload) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-strong border border-glass-border bg-surface-glass backdrop-blur-xl sm:max-w-md"
        aria-describedby={undefined}
      >
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            {t("share.sheet.eyebrow")}
          </div>
          <DialogTitle className="text-left text-lg font-semibold leading-snug">
            {payload.title}
          </DialogTitle>
          <p className="text-left text-sm text-foreground-muted">{emotionalMessage}</p>
        </DialogHeader>

        {/* Share card preview — poster + tagline + QR to /phim/{slug}?ref=share */}
        <ShareCardPreview
          title={payload.title}
          posterUrl={payload.posterUrl}
          url={url}
          tagline={t("share.card.tagline")}
          brand={t("share.card.brand")}
          qrHint={t("share.card.qrHint")}
        />



        {/* Channel grid */}
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {channels.map((c) => (
            <ChannelButton
              key={c.key}
              channel={c}
              onClick={() => openChannel(c)}
              reduce={!!reduce}
            />
          ))}
        </div>

        {/* Link row */}
        <div className="mt-3 flex items-stretch gap-2 rounded-2xl border border-glass-border bg-foreground/5 p-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
            <Link2 className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
            <span className="truncate text-xs text-foreground/90" title={url}>
              {url}
            </span>
          </div>
          <CopyBtn
            active={copiedKey === "link"}
            reduce={!!reduce}
            onClick={() => doCopy(url, "link")}
            label={t("share.actions.copyLink")}
            copiedLabel={t("share.actions.copied")}
          />
        </div>

        <button
          type="button"
          onClick={() => doCopy(`${payload.title} — ${url}`, "titleLink")}
          className={cn(
            "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-glass-border bg-foreground/5 px-4 py-2.5 text-sm font-medium text-foreground/90",
            "transition hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            copiedKey === "titleLink" && "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copiedKey === "titleLink" ? (
              <motion.span
                key="ok"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: ease.outSoft }}
                className="inline-flex items-center gap-2"
              >
                <Check className="h-4 w-4" aria-hidden />
                {t("share.actions.copied")}
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: ease.outSoft }}
                className="inline-flex items-center gap-2"
              >
                <Copy className="h-4 w-4" aria-hidden />
                {t("share.actions.copyTitleLink")}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </DialogContent>
    </Dialog>
  );
}

function ChannelButton({
  channel,
  onClick,
  reduce,
}: {
  channel: Channel;
  onClick: () => void;
  reduce: boolean;
}) {
  const Icon = channel.icon;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      aria-label={channel.label}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-2xl border border-glass-border bg-foreground/5 p-3",
        "transition hover:border-primary/40 hover:bg-foreground/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 transition",
          "group-hover:bg-white/10",
        )}
      >
        <Icon className={cn("h-4 w-4", channel.tint)} aria-hidden />
      </span>
      <span className="text-[11px] font-medium text-foreground/85">{channel.label}</span>
    </motion.button>
  );
}

function CopyBtn({
  active,
  reduce,
  onClick,
  label,
  copiedLabel,
}: {
  active: boolean;
  reduce: boolean;
  onClick: () => void;
  label: string;
  copiedLabel: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold",
        "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        active
          ? "bg-primary/20 text-primary shadow-[0_0_20px_-4px_oklch(0.68_0.24_25/0.6)]"
          : "bg-primary/90 text-primary-foreground hover:bg-primary",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {active ? (
          <motion.span
            key="ok"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            {copiedLabel}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* -------------------------------------------------------------------------- */
/*  ShareCardPreview                                                          */
/*  Cinematic dopamine artefact — poster + tagline + QR. Fully in-DOM so      */
/*  screen readers see it and the user can screenshot without extra tooling.  */
/* -------------------------------------------------------------------------- */

function ShareCardPreview({
  title,
  posterUrl,
  url,
  tagline,
  brand,
  qrHint,
}: {
  title: string;
  posterUrl?: string;
  url: string;
  tagline: string;
  brand: string;
  qrHint: string;
}) {
  return (
    <div
      role="figure"
      aria-label={`${tagline} — ${title}`}
      className="mt-4 overflow-hidden rounded-2xl border border-glass-border bg-gradient-to-br from-primary/15 via-transparent to-primary/5 p-3 shadow-inner"
    >
      <div className="flex items-stretch gap-3">
        {/* Poster */}
        <div className="relative h-[112px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-foreground/10 ring-1 ring-white/10">
          {posterUrl ? (
            <img
              src={thumbSrc(posterUrl, { w: 240 })}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-[10px] text-foreground-muted">
              {brand}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        {/* Copy + QR */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">
              {tagline}
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {title}
            </p>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-muted">
              {brand}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1">
            <div className="rounded-lg bg-white p-1.5 ring-1 ring-black/10">
              <QRCodeSVG
                value={url}
                size={72}
                level="M"
                marginSize={0}
                aria-label={qrHint}
              />
            </div>
            <span className="max-w-[76px] text-center text-[9px] leading-tight text-foreground-muted">
              {qrHint}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

