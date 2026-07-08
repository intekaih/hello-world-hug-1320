import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-px w-6 bg-gradient-to-r from-primary to-transparent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/90">
            {eyebrow}
          </span>
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-foreground-subtle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
