import { motion } from "motion/react";
import type { ReactNode } from "react";
import { ease } from "@/lib/design";

/**
 * CinemaModeLayout
 * ------------------------------------------------------------------
 * Full-viewport black stage with a soft cinematic fade+scale entrance.
 * Sits on top of the app-shell's already-hidden nav for /xem/* routes.
 * Motion respects prefers-reduced-motion via `motion` library defaults
 * plus a css-only fallback.
 */
export function CinemaModeLayout({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: ease.out }}
      className="relative min-h-dvh overflow-hidden bg-black text-white motion-reduce:transform-none"
    >
      {children}
    </motion.div>
  );
}
