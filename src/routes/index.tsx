import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
  CategoryChips,
  ContinueWatching,
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
import { GenreCosmos } from "@/components/home/genre-cosmos";
import { SceneSection } from "@/components/home/scene-section";
import { homeQueryOptions } from "@/lib/home-queries";
import { buildPageMeta } from "@/lib/page-meta";

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
  const { data, isLoading, isError, refetch } = useQuery(homeQueryOptions);

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
    <Stagger>
      {/* SCENE 01 — Cinematic opening */}
      <StaggerItem>
        <CinematicHero movies={data.heroMovies} />
      </StaggerItem>

      <StaggerItem>
        <CategoryChips />
      </StaggerItem>

      {/* SCENE 02 — Continue Watching (indigo mood, personal) */}
      {isLoggedIn && data.continueWatching.length > 0 && (
        <StaggerItem>
          <SceneSection mood="indigo" eyebrow="Đang xem · Resume" intensity={0.9}>
            <ContinueWatching items={data.continueWatching} />
          </SceneSection>
        </StaggerItem>
      )}

      {/* SCENE 03 — Trending Today (ember, hot) */}
      <StaggerItem>
        <SceneSection mood="ember" eyebrow="🔥 Trending Today">
          <Top10Section movies={data.top10Movies} />
        </SceneSection>
      </StaggerItem>

      {/* SCENE 04 — Editor's Pick (amber, curated) */}
      <StaggerItem>
        <SceneSection
          mood="amber"
          eyebrow="✦ Editor's Pick"
          title="Chọn lọc bởi biên tập"
          subtitle="Những series đang được cả biên tập viên và người xem gọi tên trong tuần này."
        >
          <MovieRow movies={data.hotSeriesMovies} />
        </SceneSection>
      </StaggerItem>

      {/* SCENE 05 — Feature Presentation (cinematic spotlight) */}
      {data.heroMovies[1] && (
        <StaggerItem>
          <CinematicScene
            movie={data.heroMovies[1]}
            eyebrow="Feature Presentation"
            kicker="In spotlight this week"
          />
        </StaggerItem>
      )}

      {/* SCENE 06 — Because You Watched (violet, personal) */}
      <StaggerItem>
        <SceneSection
          mood="violet"
          eyebrow="✧ Because you watched"
          title="Dành riêng cho bạn"
          subtitle="Gợi ý dựa trên tâm trạng gần đây và những gì bạn đã lưu."
        >
          <MovieRow movies={data.newMovies} />
        </SceneSection>
      </StaggerItem>

      {/* SCENE 07 — Cinematic Collection (cyan, cool prestige) */}
      <StaggerItem>
        <SceneSection
          mood="cyan"
          eyebrow="◆ Cinematic Collection"
          title="Đêm chiếu tại rạp nhà"
          subtitle="Những bộ phim đáng xem trên màn hình lớn nhất trong nhà bạn."
        >
          <GenreCosmos />
        </SceneSection>
      </StaggerItem>

      {/* SCENE 08 — Anime spotlight (rose, human warmth) */}
      <StaggerItem>
        <SceneSection
          mood="rose"
          eyebrow="❀ Anime tuyển chọn"
          title="Bộ sưu tập từ Nhật Bản"
          subtitle="Từ shounen kịch tính đến slice-of-life dịu êm — cả một vũ trụ animation đang đợi."
        >
          <MovieRow movies={data.animeMovies} />
        </SceneSection>
      </StaggerItem>

      {/* SCENE 09 — Hidden Gems (emerald, discovery) */}
      <StaggerItem>
        <SceneSection
          mood="emerald"
          eyebrow="◉ Hidden Gems"
          title="Có thể bạn chưa biết"
          subtitle="Những viên ngọc ít người xem nhưng đáng để dành một buổi tối."
        >
          <MovieRow movies={data.top10Movies.slice(2).concat(data.top10Movies.slice(0, 2))} />
        </SceneSection>
      </StaggerItem>

      {/* SCENE 10 — Coming Soon (midnight, mystery) */}
      <StaggerItem>
        <SceneSection
          mood="midnight"
          eyebrow="◐ Coming Soon"
          title="Sắp ra mắt"
          subtitle="Đánh dấu lịch — những cái tên đang được chờ đợi nhất."
        >
          <MovieRow movies={data.newMovies.slice().reverse()} />
        </SceneSection>
      </StaggerItem>
    </Stagger>
  );
}
