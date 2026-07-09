import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  CategoryChips,
  ContinueWatchingSkeleton,
  HeroBannerSkeleton,
  MovieRow,
  MovieRowSkeleton,
  Stagger,
  StaggerItem,
  Top10Section,
  Top10Skeleton,
} from "@/components/home";
import { CinematicHero } from "@/components/home/cinematic-hero";
import { CinematicScene } from "@/components/home/cinematic-scene";
import { ComingSoonScene } from "@/components/home/coming-soon-scene";
import { ContinueWatchingImmersive } from "@/components/home/continue-watching-immersive";
import { EditorialScene } from "@/components/home/editorial-scene";
import { GenreCosmos } from "@/components/home/genre-cosmos";
import { MysteryScene } from "@/components/home/mystery-scene";
import { SceneAtmosphere } from "@/components/home/scene-atmosphere";
import { SceneSection } from "@/components/home/scene-section";
import { homeQueryOptions } from "@/lib/home-queries";
import { buildPageMeta } from "@/lib/page-meta";
import { getDaypart, readHourOverride, rerankForLateNight } from "@/lib/daypart";
import { useTranslation } from "@/hooks/useTranslation";


export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: buildPageMeta({
      title: "movieCC - Xem phim HD miễn phí",
      description:
        "movieCC - Xem phim online HD Vietsub, thuyết minh. Kho phim bộ, phim lẻ, anime, TV shows mới nhất cập nhật hằng ngày, xem miễn phí không quảng cáo.",
      url: "/",
      type: "website",
    }),
    links: [{ rel: "canonical", href: "/" }],
  }),
});

const isLoggedIn = true;

function Home() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery(homeQueryOptions);

  const daypart = useMemo(() => getDaypart(readHourOverride()), []);
  const dpEyebrow = t(`home.daypart.${daypart}.eyebrow`);
  const dpTitle = t(`home.daypart.${daypart}.title`);
  const dpSubtitle = t(`home.daypart.${daypart}.subtitle`);
  const forYou = useMemo(() => {
    if (!data) return [];
    return daypart === "late_night"
      ? rerankForLateNight(data.newMovies)
      : data.newMovies;
  }, [data, daypart]);
  const animeSorted = useMemo(() => {
    if (!data) return [];
    return daypart === "late_night"
      ? rerankForLateNight(data.animeMovies)
      : data.animeMovies;
  }, [data, daypart]);


  if (isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-foreground-muted">Không tải được trang chủ.</p>
        <button
          onClick={() => refetch()}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-10">
        <HeroBannerSkeleton />
        <ContinueWatchingSkeleton />
        <Top10Skeleton />
        <MovieRowSkeleton />
        <MovieRowSkeleton />
        <MovieRowSkeleton />
      </div>
    );
  }

  return (
    <>
      {/* Global cinematic backdrop — morphs colour as scenes come into focus. */}
      <SceneAtmosphere />

      <div className="relative z-10">
        <Stagger>

        {/* SCENE 01 — Opening — cold cinematic blue */}
        <StaggerItem>
          <div data-scene-mood="hero">
            {(() => {
              const cw = data.continueWatching.find(
                (c) => c.progress > 0.05 && c.progress < 0.95,
              );
              const epMatch = cw?.title.match(/Ep\s*(\d+)/i);
              const resume = cw
                ? {
                    slug: cw.slug,
                    title: cw.title,
                    progress: cw.progress,
                    remaining: cw.remaining,
                    episode: epMatch?.[1],
                  }
                : undefined;
              return <CinematicHero movies={data.heroMovies} resume={resume} />;
            })()}
          </div>
        </StaggerItem>

        <StaggerItem>
          <CategoryChips />
        </StaggerItem>

        {/* SCENE 02 — Continue Watching — indigo, comfort, drift entrance */}
        {isLoggedIn && data.continueWatching.length > 0 && (
          <StaggerItem>
            <SceneSection mood="indigo" intensity={0.9} entrance="drift" particles="dust">
              <ContinueWatchingImmersive items={data.continueWatching} />
            </SceneSection>
          </StaggerItem>
        )}

        {/* SCENE 03 — Trending Today — ember, epic, iris entrance, huge numbers */}
        <StaggerItem>
          <SceneSection
            mood="ember"
            eyebrow="🔥 Trending Today"
            entrance="iris"
            particles="sparks"
          >
            <Top10Section movies={data.top10Movies} />
          </SceneSection>
        </StaggerItem>

        {/* SCENE 04 — Editor's Pick — amber, magazine editorial, focus entrance */}
        <StaggerItem>
          <SceneSection
            mood="amber"
            eyebrow="✦ Editor's Pick"
            title="Chọn lọc bởi biên tập"
            subtitle="Những series đang được cả biên tập viên và người xem gọi tên trong tuần này."
            entrance="focus"
          >
            <EditorialScene movies={data.hotSeriesMovies} />
          </SceneSection>
        </StaggerItem>

        {/* SCENE 05 — Feature Presentation — cinematic spotlight (own layout) */}
        {data.heroMovies[1] && (
          <StaggerItem>
            <div data-scene-mood="gold">
              <CinematicScene
                movie={data.heroMovies[1]}
                eyebrow="Feature Presentation"
                kicker="In spotlight this week"
              />
            </div>
          </StaggerItem>
        )}

        {/* SCENE 06 — Because You Watched — violet, sweep camera pan */}
        <StaggerItem>
          <SceneSection
            mood="violet"
            eyebrow="✧ Because you watched"
            title="Dành riêng cho bạn"
            subtitle="Gợi ý dựa trên tâm trạng gần đây và những gì bạn đã lưu."
            entrance="sweep"
          >
            <MovieRow movies={data.newMovies} />
          </SceneSection>
        </StaggerItem>

        {/* SCENE 07 — Cinematic Collection — cyan, focus entrance, GenreCosmos */}
        <StaggerItem>
          <SceneSection
            mood="cyan"
            eyebrow="◆ Cinematic Collection"
            title="Đêm chiếu tại rạp nhà"
            subtitle="Những bộ phim đáng xem trên màn hình lớn nhất trong nhà bạn."
            entrance="focus"
            particles="rain"
          >
            <GenreCosmos />
          </SceneSection>
        </StaggerItem>

        {/* SCENE 08 — Anime — rose, warm, drift with dust */}
        <StaggerItem>
          <SceneSection
            mood="rose"
            eyebrow="❀ Anime tuyển chọn"
            title="Bộ sưu tập từ Nhật Bản"
            subtitle="Từ shounen kịch tính đến slice-of-life dịu êm — cả một vũ trụ animation đang đợi."
            entrance="drift"
            particles="dust"
          >
            <MovieRow movies={data.animeMovies} />
          </SceneSection>
        </StaggerItem>

        {/* SCENE 09 — Hidden Gems — emerald, heavy contrast, veiled mystery grid */}
        <StaggerItem>
          <SceneSection
            mood="emerald"
            eyebrow="◉ Hidden Gems"
            title="Có thể bạn chưa biết"
            subtitle="Những viên ngọc ít người xem nhưng đáng để dành một buổi tối."
            entrance="focus"
          >
            <MysteryScene
              movies={data.top10Movies
                .slice(2)
                .concat(data.top10Movies.slice(0, 2))}
            />
          </SceneSection>
        </StaggerItem>

        {/* SCENE 10 — Coming Soon — midnight, moving light beam, timeline layout */}
        <StaggerItem>
          <SceneSection
            mood="midnight"
            eyebrow="◐ Coming Soon"
            title="Sắp ra mắt"
            subtitle="Đánh dấu lịch — những cái tên đang được chờ đợi nhất."
            entrance="drift"
            particles="beam"
          >
            <ComingSoonScene movies={data.newMovies.slice().reverse()} />
          </SceneSection>
        </StaggerItem>
        </Stagger>
      </div>
    </>
  );
}

