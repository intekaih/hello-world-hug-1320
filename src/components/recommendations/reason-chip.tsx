import { Flame, Globe2, Sparkles, Star, Tv, Bookmark, RefreshCw, Compass, Play, TrendingUp } from "lucide-react";
import type { ReasonKind } from "@/lib/recommendations/engine";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const ICON: Record<ReasonKind, typeof Flame> = {
  sameGenre: Flame,
  sameCountry: Globe2,
  similarMood: Sparkles,
  highlyRated: Star,
  newEpisode: Tv,
  fromWatchlist: Bookmark,
  resume: Play,
  rewatch: RefreshCw,
  unexplored: Compass,
  trending: TrendingUp,
};

export function RecommendationReasonChip({
  reason,
  value,
  className,
}: {
  reason: ReasonKind;
  value?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const Icon = ICON[reason];
  const label = value
    ? t(`recommendations.reasonWithValue.${reason}`, { value, defaultValue: t(`recommendations.reason.${reason}`) })
    : t(`recommendations.reason.${reason}`);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm ring-1 ring-white/10",
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5 text-primary/90" strokeWidth={2.4} />
      <span className="line-clamp-1">{label}</span>
    </span>
  );
}
