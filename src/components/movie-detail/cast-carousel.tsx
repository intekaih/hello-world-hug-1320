import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeader } from "./section-header";

/**
 * CastCarousel — premium horizontal snap rail with avatar fallback,
 * subtle 3D lift and glow on hover.
 */
export function CastCarousel({ cast }: { cast: string[] }) {
  const { t } = useTranslation();
  if (!cast.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={t("movieDetail.cast.eyebrow")}
        title={t("movieDetail.cast.title")}
      />
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {cast.map((name, i) => (
          <CastCard key={`${name}-${i}`} name={name} index={i} />
        ))}
      </div>
    </section>
  );
}

const PALETTE = [
  "oklch(0.68 0.24 25)",
  "oklch(0.78 0.18 55)",
  "oklch(0.72 0.15 200)",
  "oklch(0.75 0.16 320)",
  "oklch(0.82 0.14 85)",
];

function CastCard({ name, index }: { name: string; index: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(py - 0.5) * -8}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * 10}deg`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.04, 0.35),
        ease: ease.outSoft,
      }}
      className="shrink-0 snap-start"
    >
      <Link
        ref={ref}
        to="/dien-vien/$name"
        params={{ name: name.toLowerCase().replace(/\s+/g, "-") }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="group flex w-[128px] flex-col items-center gap-3 text-center [perspective:800px]"
        style={{ ["--rx" as string]: "0deg", ["--ry" as string]: "0deg" }}
      >
        <div
          className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full font-display text-2xl font-semibold text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-[transform,box-shadow,ring] duration-500 will-change-transform group-hover:ring-primary/60 group-hover:shadow-[0_25px_60px_-15px_oklch(0.68_0.24_25/0.55)]"
          style={{
            background: `linear-gradient(135deg, ${PALETTE[index % PALETTE.length]}, oklch(0.14 0.015 260))`,
            transform: "rotateX(var(--rx)) rotateY(var(--ry))",
            transformStyle: "preserve-3d",
          }}
          aria-hidden
        >
          {initials}
          {/* Ambient glow */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
            style={{
              background: `radial-gradient(circle, ${PALETTE[index % PALETTE.length]}, transparent 70%)`,
            }}
          />
          {/* Sheen */}
          <span className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
        </div>
        <div>
          <div className="line-clamp-2 text-sm font-medium text-foreground transition group-hover:text-primary">
            {name}
          </div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.24em] text-foreground-subtle">
            {/* Character not available in current data contract */}
            &nbsp;
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
