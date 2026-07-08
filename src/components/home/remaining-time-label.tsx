import { Clock3 } from "lucide-react";

/**
 * Small monochrome chip communicating remaining time.
 * Purely presentational — no motion, no state.
 */
export function RemainingTimeLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
      <Clock3 className="h-3 w-3 opacity-80" aria-hidden />
      {label}
    </span>
  );
}
