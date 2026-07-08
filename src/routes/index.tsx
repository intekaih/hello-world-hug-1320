import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
  CategoryChips,
  ContinueWatching,
  ContinueWatchingSkeleton,
  HeroBanner,
  HeroBannerSkeleton,
  MovieRow,
  MovieRowSkeleton,
  Stagger,
  StaggerItem,
  Top10Section,
  Top10Skeleton,
} from "@/components/home";
import { homeQueryOptions } from "@/lib/home-queries";

export const Route = createFileRoute("/")({
  component: Home,
});

// Toggle to `false` to hide the "Continue watching" row.
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
      <StaggerItem>
        <HeroBanner movies={data.heroMovies} />
      </StaggerItem>

      <StaggerItem>
        <CategoryChips />
      </StaggerItem>

      {isLoggedIn && (
        <StaggerItem>
          <ContinueWatching items={data.continueWatching} />
        </StaggerItem>
      )}

      <StaggerItem>
        <Top10Section movies={data.top10Movies} />
      </StaggerItem>

      <StaggerItem>
        <MovieRow
          title="Phim bộ đang hot"
          subtitle="Series được xem nhiều"
          movies={data.hotSeriesMovies}
        />
      </StaggerItem>

      <StaggerItem>
        <MovieRow
          title="Mới cập nhật"
          subtitle="Vừa lên sóng tuần này"
          movies={data.newMovies}
        />
      </StaggerItem>

      <StaggerItem>
        <MovieRow
          title="Anime tuyển chọn"
          subtitle="Bộ sưu tập từ Nhật Bản"
          movies={data.animeMovies}
        />
      </StaggerItem>
    </Stagger>
  );
}
