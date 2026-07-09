/**
 * HeroTrailer — resilient hero backdrop that upgrades to video when a
 * direct trailer URL is available and gracefully falls back otherwise.
 *
 * States (all handled internally):
 *   · none / unsupported → Ken Burns backdrop only
 *   · youtube / vimeo    → Ken Burns backdrop + "Watch Trailer" external btn
 *   · direct             → <video muted loop playsInline autoPlay>, fade in
 *                          on canplay, pause when tab hidden or off-screen,
 *                          revert to backdrop on error.
 */
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

import { thumbSrc } from "@/utils/thumbSrc";
import { normalizeTrailerSource, type TrailerSource } from "@/lib/media/trailer";
import { cn } from "@/lib/utils";

type Movie = {
  backdrop_url: string;
  title: string;
  trailer_url?: string | null;
};

export function HeroTrailer({
  movie,
  className,
}: {
  movie: Movie;
  className?: string;
}) {
  const source = normalizeTrailerSource(movie);
  const backdrop = (
    <img
      src={thumbSrc(movie.backdrop_url, { w: 1920 })}
      alt=""
      className="ken-burns h-[112%] w-[108%] -translate-x-[4%] -translate-y-[6%] object-cover"
    />
  );

  if (source.kind === "direct") {
    return (
      <DirectVideo
        source={source}
        backdrop={backdrop}
        className={className}
        title={movie.title}
      />
    );
  }

  const external =
    source.kind === "youtube" || source.kind === "vimeo"
      ? source.external
      : null;

  return (
    <div className={cn("absolute inset-0", className)}>
      {backdrop}
      {external && (
        <a
          href={external}
          target="_blank"
          rel="noopener noreferrer"
          className="glass absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground hover:bg-foreground/10"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Trailer
        </a>
      )}
    </div>
  );
}

function DirectVideo({
  source,
  backdrop,
  className,
  title,
}: {
  source: Extract<TrailerSource, { kind: "direct" }>;
  backdrop: React.ReactNode;
  className?: string;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onCanPlay = () => setReady(true);
    const onError = () => setErrored(true);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);

    const onVis = () => {
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);

    // Best-effort autoplay kick — muted+playsInline usually allows this
    v.play().catch(() => {});

    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
  }, [source.src]);

  return (
    <div className={cn("absolute inset-0", className)}>
      {backdrop}
      {!errored && (
        <video
          ref={videoRef}
          src={source.src}
          poster={undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-label={`${title} trailer`}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
