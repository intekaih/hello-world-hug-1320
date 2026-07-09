import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { thumbSrc } from "@/utils/thumbSrc";

/**
 * Cinematic title reveal — vertical rise + blur clear.
 * Falls back to stylized display typography when no logo image exists.
 */
export function MovieLogoReveal({
  logo,
  title,
}: {
  logo?: string;
  title: string;
}) {
  const reduce = useReducedMotion();
  const [ok, setOk] = useState(true);

  const rise = reduce
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: [0, 1], y: [24, 0], filter: ["blur(14px)", "blur(0px)"] };

  if (logo && ok) {
    return (
      <motion.img
        initial={false}
        animate={rise}
        transition={{ duration: 1.1, ease: ease.outSoft, delay: 0.15 }}
        src={thumbSrc(logo, { w: 640 })}
        alt={title}
        onError={() => setOk(false)}
        className="max-h-28 w-auto max-w-[80%] object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.65)] sm:max-h-40"
      />
    );
  }

  return (
    <motion.h1
      initial={false}
      animate={rise}
      transition={{ duration: 1.1, ease: ease.outSoft, delay: 0.15 }}
      className="font-display text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.02em] text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]"
    >
      <span
        className="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent"
        style={{ WebkitTextStroke: "0.4px rgba(255,255,255,0.08)" }}
      >
        {title}
      </span>
    </motion.h1>
  );
}
