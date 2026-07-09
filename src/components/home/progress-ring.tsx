import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ease } from "@/lib/design";

type Props = {
  progress: number; // 0..1
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  glow?: boolean;
};

/**
 * Cinematic circular progress ring with animated stroke and progress-based glow.
 * Renders `children` in the exact center — typically a floating Play button.
 */
export function ProgressRing({
  progress,
  size = 76,
  stroke = 3,
  children,
  glow = true,
}: Props) {
  const reduce = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);

  // Warm→hot glow intensity based on progress
  const glowOpacity = 0.35 + clamped * 0.55;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full blur-xl transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(circle, var(--color-primary) 0%, transparent 65%)",
            opacity: glowOpacity,
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(1 0 0 / 0.15)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 1.1, ease: ease.outSoft }
          }
          style={{
            filter: "drop-shadow(0 0 6px var(--color-primary))",
          }}

        />
        <defs>
          <linearGradient id="ring-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-accent, var(--color-primary))" />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

/** Number that counts up when it comes into view — pairs with the ring. */
export function AnimatedPercent({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const target = Math.round(value * 100);
  const [n, setN] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);

  return <span className="tabular-nums">{n}%</span>;
}
