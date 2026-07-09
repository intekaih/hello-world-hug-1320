import { motion, useReducedMotion } from "motion/react";
import { Share2 } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useShareMovie, type SharePayload } from "@/lib/share/use-share-movie";

type Props = ComponentProps<"button"> & {
  payload: SharePayload | (() => SharePayload);
  variant?: "solid" | "ghost" | "icon";
};

/**
 * ShareButton — thin wrapper opening the global ShareSheet.
 * Accepts payload as value or getter (getter lets the caller
 * capture live state like the current player timestamp).
 */
export function ShareButton({
  payload,
  variant = "ghost",
  className,
  children,
  ...rest
}: Props) {
  const { open } = useShareMovie();
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const onClick = () => {
    const p = typeof payload === "function" ? payload() : payload;
    open(p);
  };

  const base = "inline-flex items-center gap-2 rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70";
  const styles = {
    solid: "bg-primary px-4 py-2 text-primary-foreground shadow-md shadow-primary/25 hover:shadow-primary/40",
    ghost: "border border-white/12 bg-white/5 px-4 py-2 text-foreground/90 hover:bg-white/10",
    icon: "h-10 w-10 justify-center text-foreground/85 hover:bg-white/10",
  }[variant];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 420, damping: 20 }}
      className={cn(base, styles, className)}
      aria-label={t("share.actions.share")}
      {...(rest as ComponentProps<typeof motion.button>)}
    >
      <Share2 className="h-4 w-4" aria-hidden />
      {children}
    </motion.button>
  );
}
