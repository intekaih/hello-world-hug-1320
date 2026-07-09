import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef, type ReactNode, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { ease } from "@/lib/design";

/**
 * SceneSection — wraps a homepage row in a scroll-linked cinematic scene.
 *
 * Each section gets its own "mood": accent color, ambient orb positions,
 * lighting angle, particle density. As the user scrolls a section into
 * view the background morphs — orbs drift, gradients breathe, a tint
 * fades in — then releases as it exits. Section boundaries dissolve so
 * the homepage feels like continuous camera movement, not stacked cards.
 */

export type SceneMood =
  | "ember" // warm orange/red — trending, hot
  | "amber" // gold — editor's picks, prestige
  | "violet" // purple/magenta — because you watched, personal
  | "cyan" // teal/blue — cinematic collection, cool
  | "gold" // deep gold — Oscar / awards
  | "rose" // pink — actor spotlight, human
  | "emerald" // green — hidden gems
  | "indigo" // deep blue — new episodes
  | "midnight"; // dark cyan — coming soon

const MOOD_TOKENS: Record<
  SceneMood,
  {
    a: string; // primary orb color
    b: string; // secondary orb color
    tint: string; // ambient tint
    accent: string; // small accent (for eyebrow chip)
  }
> = {
  ember: {
    a: "oklch(0.65 0.24 25 / 0.55)",
    b: "oklch(0.55 0.20 15 / 0.35)",
    tint: "oklch(0.25 0.10 20 / 0.18)",
    accent: "oklch(0.70 0.22 30)",
  },
  amber: {
    a: "oklch(0.78 0.18 70 / 0.45)",
    b: "oklch(0.55 0.14 55 / 0.30)",
    tint: "oklch(0.28 0.08 65 / 0.15)",
    accent: "oklch(0.80 0.16 75)",
  },
  violet: {
    a: "oklch(0.55 0.22 300 / 0.55)",
    b: "oklch(0.40 0.18 320 / 0.35)",
    tint: "oklch(0.22 0.10 300 / 0.20)",
    accent: "oklch(0.68 0.22 305)",
  },
  cyan: {
    a: "oklch(0.75 0.14 210 / 0.45)",
    b: "oklch(0.45 0.12 230 / 0.35)",
    tint: "oklch(0.22 0.08 220 / 0.18)",
    accent: "oklch(0.78 0.15 210)",
  },
  gold: {
    a: "oklch(0.80 0.16 85 / 0.50)",
    b: "oklch(0.50 0.14 65 / 0.35)",
    tint: "oklch(0.25 0.08 70 / 0.20)",
    accent: "oklch(0.82 0.16 85)",
  },
  rose: {
    a: "oklch(0.68 0.20 10 / 0.45)",
    b: "oklch(0.50 0.18 350 / 0.35)",
    tint: "oklch(0.24 0.08 10 / 0.16)",
    accent: "oklch(0.72 0.20 8)",
  },
  emerald: {
    a: "oklch(0.65 0.16 155 / 0.40)",
    b: "oklch(0.40 0.12 170 / 0.30)",
    tint: "oklch(0.22 0.08 160 / 0.18)",
    accent: "oklch(0.70 0.18 155)",
  },
  indigo: {
    a: "oklch(0.50 0.20 265 / 0.55)",
    b: "oklch(0.35 0.16 280 / 0.40)",
    tint: "oklch(0.20 0.10 265 / 0.22)",
    accent: "oklch(0.65 0.22 260)",
  },
  midnight: {
    a: "oklch(0.40 0.14 240 / 0.45)",
    b: "oklch(0.25 0.10 260 / 0.35)",
    tint: "oklch(0.15 0.06 250 / 0.28)",
    accent: "oklch(0.60 0.18 240)",
  },
};

export function SceneSection({
  children,
  mood,
  eyebrow,
  title,
  subtitle,
  align = "left",
  intensity = 1,
  entrance = "rise",
  particles,
  className,
}: {
  children: ReactNode;
  mood: SceneMood;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: "left" | "center";
  intensity?: number;
  /**
   * Entrance motion language — each scene should feel arrived at, not
   * scrolled past. `rise` is the default; other values create distinct
   * kinesthetic signatures per scene.
   */
  entrance?: "rise" | "focus" | "sweep" | "iris" | "drift";
  /** Optional decorative particle overlay flavour. */
  particles?: "dust" | "sparks" | "beam" | "rain";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const tokens = MOOD_TOKENS[mood];

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Orb drift + tint breathing
  const orbAY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-30%", "20%"]);
  const orbBY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["30%", "-20%"]);
  const orbAX = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-10%", "8%"]);
  const orbBX = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["12%", "-8%"]);
  const tintOpacity = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    [0, intensity, intensity, 0],
  );

  const entranceVariants = getEntranceVariants(entrance, !!reduce);

  return (
    <section
      ref={ref}
      data-mood={mood}
      data-scene-mood={mood}
      data-entrance={entrance}
      className={cn(
        "relative -mx-4 overflow-hidden px-4 py-14 sm:-mx-6 sm:px-6 sm:py-20 lg:-mx-8 lg:px-8",
        className,
      )}
      style={
        {
          "--scene-accent": tokens.accent,
        } as CSSProperties
      }
    >

      {/* Ambient tint wash */}
      <motion.div
        aria-hidden
        style={{ opacity: tintOpacity, background: tokens.tint }}
        className="pointer-events-none absolute inset-0"
      />

      {/* Drifting orb A */}
      <motion.div
        aria-hidden
        style={{ y: orbAY, x: orbAX }}
        className="pointer-events-none absolute -left-[20%] top-[-10%] h-[520px] w-[520px] rounded-full blur-[120px] will-change-transform"
      >
        <div className="h-full w-full rounded-full" style={{ background: tokens.a }} />
      </motion.div>

      {/* Drifting orb B */}
      <motion.div
        aria-hidden
        style={{ y: orbBY, x: orbBX }}
        className="pointer-events-none absolute -right-[15%] bottom-[-20%] h-[480px] w-[480px] rounded-full blur-[130px] will-change-transform"
      >
        <div className="h-full w-full rounded-full" style={{ background: tokens.b }} />
      </motion.div>

      {/* Subtle grid noise */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />

      {/* Decorative particle overlay (per-scene flavour). */}
      {particles && !reduce && <SceneParticles kind={particles} accent={tokens.accent} />}

      {/* Section header */}
      {(eyebrow || title || subtitle) && (
        <header
          className={cn(
            "relative z-10 mb-8 flex flex-col gap-2",
            align === "center" && "items-center text-center",
          )}
        >
          {eyebrow && (
            <div
              className={cn(
                "flex items-center gap-2.5",
                align === "center" && "justify-center",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: tokens.accent, boxShadow: `0 0 12px ${tokens.accent}` }}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.34em]"
                style={{ color: tokens.accent }}
              >
                {eyebrow}
              </span>
            </div>
          )}
          {title && (
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl lg:text-[2.75rem]">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="max-w-xl text-sm text-foreground/70 sm:text-[15px]">{subtitle}</p>
          )}
        </header>
      )}

      <motion.div
        initial={reduce ? false : entranceVariants.initial}
        whileInView={entranceVariants.whileInView}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={entranceVariants.transition}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Entrance grammar — each scene arrives with its own kinesthetic signature. */
/* -------------------------------------------------------------------------- */

type EntranceSpec = {
  initial: Record<string, number | string>;
  whileInView: Record<string, number | string>;
  transition: {
    duration: number;
    ease: [number, number, number, number];
    delay?: number;
  };
};

function getEntranceVariants(
  kind: "rise" | "focus" | "sweep" | "iris" | "drift",
  reduce: boolean,
): EntranceSpec {
  const NONE: EntranceSpec = {
    initial: { opacity: 1 },
    whileInView: { opacity: 1 },
    transition: { duration: 0, ease: ease.outSoft },
  };

  if (reduce) return NONE;

  switch (kind) {
    case "focus":
      // Camera "pulls focus" — starts blurred and defocused, snaps sharp.
      return {
        initial: { opacity: 0, filter: "blur(18px)", scale: 1.04 },
        whileInView: { opacity: 1, filter: "blur(0px)", scale: 1 },
        transition: { duration: 1.1, ease: ease.outSoft },
      };
    case "sweep":
      // Lateral camera pan across the scene.
      return {
        initial: { opacity: 0, x: -40 },
        whileInView: { opacity: 1, x: 0 },
        transition: { duration: 0.9, ease: ease.out },
      };
    case "iris":
      // Epic reveal — scale-in from a heavy, cinematic starting pose.
      return {
        initial: { opacity: 0, scale: 0.92, y: 20 },
        whileInView: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 1.05, ease: ease.outSoft },
      };
    case "drift":
      // Slow ambient drift — for coming-soon, floating-through-space vibe.
      return {
        initial: { opacity: 0, y: 40, filter: "blur(6px)" },
        whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { duration: 1.3, ease: ease.outSoft },
      };
    case "rise":
    default:
      return {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.8, ease: ease.outSoft },
      };
  }
}

/* -------------------------------------------------------------------------- */
/*  Particle overlays — CSS-only, cheap, and paused when offscreen naturally  */
/*  because they use transform-only keyframes with will-change hints.         */
/* -------------------------------------------------------------------------- */

function SceneParticles({
  kind,
  accent,
}: {
  kind: "dust" | "sparks" | "beam" | "rain";
  accent: string;
}) {
  if (kind === "beam") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -left-1/3 top-0 h-full w-[60%] -skew-x-12 opacity-40 mix-blend-screen animate-[scene-beam_9s_linear_infinite]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            filter: "blur(28px)",
          }}
        />
      </div>
    );
  }

  const count = kind === "rain" ? 24 : kind === "sparks" ? 18 : 14;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: count }).map((_, i) => {
        const delay = ((i * 0.63) % 6).toFixed(2);
        const dur = kind === "rain" ? 5 + ((i * 0.31) % 4) : 8 + ((i * 0.47) % 6);
        const left = ((i * 137.5) % 100).toFixed(2);
        const size = kind === "sparks" ? 3 : kind === "rain" ? 1.5 : 2;
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: "-10%",
              width: `${size}px`,
              height: kind === "rain" ? `${size * 6}px` : `${size}px`,
              background:
                kind === "sparks" ? accent : "rgba(255,255,255,0.55)",
              boxShadow:
                kind === "sparks" ? `0 0 8px ${accent}` : "0 0 4px rgba(255,255,255,0.4)",
              animation: `scene-float ${dur}s linear ${delay}s infinite`,
              opacity: 0.65,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
}

