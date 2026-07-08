import { AlertTriangle, RefreshCcw, Server } from "lucide-react";
import type { ServerSource } from "./player";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export type PlayerErrorKind =
  | "network"
  | "media"
  | "source"
  | "unavailable"
  | "unknown";

/**
 * PlayerErrorState — premium error surface inside the player frame.
 * Offers Retry + Change Server actions instead of a browser default.
 */
export function PlayerErrorState({
  kind = "unknown",
  servers,
  currentServer,
  onRetry,
  onChangeServer,
}: {
  kind?: PlayerErrorKind;
  servers: ServerSource[];
  currentServer: string;
  onRetry: () => void;
  onChangeServer: (id: string) => void;
}) {
  const { t } = useTranslation();
  const title = t(`player.error.${kind}.title`);
  const description = t(`player.error.${kind}.description`);
  return (
    <div
      role="alert"
      className="absolute inset-0 grid place-items-center overflow-hidden bg-black/70 p-6 backdrop-blur-md"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.28em] text-red-300/90">
          {t("player.error.eyebrow")}
        </div>
        <h3 className="mt-1 font-display text-xl font-semibold text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {description}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_oklch(0.68_0.24_25/0.7)]"
            style={{
              background:
                "var(--gradient-ember, linear-gradient(135deg,#f97316,#ef4444))",
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            {t("player.error.retry")}
          </button>
        </div>

        {servers.length > 1 && (
          <div className="mt-6">
            <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">
              <Server className="h-3 w-3" />
              {t("player.error.tryAnotherServer")}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onChangeServer(s.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium text-white transition",
                    s.id === currentServer
                      ? "border-primary/50 bg-white/10"
                      : "border-white/15 hover:border-white/30 hover:bg-white/10",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
