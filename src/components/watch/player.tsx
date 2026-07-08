import type Hls from "hls.js";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  ListVideo,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Plus,
  Settings,
  Share2,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type ServerSource = {
  id: string;
  name: string;
  src: string;
};

type Props = {
  slug: string;
  episode: string;
  totalEpisodes: number;
  title: string;
  poster?: string;
  servers: ServerSource[];
  initialTime?: number;
  onChangeEpisode: (ep: number) => void;
};

/* -------------------------------------------------------------------------- */
/*  Utils                                                                     */
/* -------------------------------------------------------------------------- */

const formatTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

/* -------------------------------------------------------------------------- */
/*  PlayerContainer                                                           */
/* -------------------------------------------------------------------------- */

export function PlayerContainer({
  slug,
  episode,
  totalEpisodes,
  title,
  poster,
  servers,
  initialTime = 0,
  onChangeEpisode,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  const currentSrc = useMemo(
    () => servers.find((s) => s.id === serverId)?.src ?? "",
    [serverId, servers],
  );

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [levels, setLevels] = useState<
    { index: number; height: number; bitrate: number }[]
  >([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [seekFeedback, setSeekFeedback] = useState<null | "back" | "fwd">(null);

  const initialTimeRef = useRef(initialTime);

  /* ---------------------------- HLS attachment ---------------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSrc) return;

    let cancelled = false;
    setLoading(true);

    const isNative = video.canPlayType("application/vnd.apple.mpegurl");

    const attach = async () => {
      if (isNative) {
        video.src = currentSrc;
        return;
      }
      const HlsMod = (await import("hls.js")).default;
      if (cancelled) return;

      if (!HlsMod.isSupported()) {
        video.src = currentSrc;
        return;
      }

      const hls = new HlsMod({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(currentSrc);
      hls.attachMedia(video);
      hls.on(HlsMod.Events.MANIFEST_PARSED, () => {
        setLevels(
          hls.levels.map((l, i) => ({
            index: i,
            height: l.height,
            bitrate: l.bitrate,
          })),
        );
      });
      hls.on(HlsMod.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentLevel(data.level);
      });
    };

    attach();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [currentSrc]);

  /* ---------------------------- Resume position --------------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const seed = initialTimeRef.current;
    const onMeta = () => {
      if (seed > 0 && seed < video.duration - 5) {
        video.currentTime = seed;
      }
      setDuration(video.duration);
      setLoading(false);
    };
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [currentSrc]);

  // If the incoming initialTime changes (episode nav), remember for next attach.
  useEffect(() => {
    initialTimeRef.current = initialTime;
  }, [initialTime]);

  /* ---------------------------- Video events ------------------------------ */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(video.currentTime);
    const onProgress = () => {
      if (video.buffered.length) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onVol = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVol);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, []);

  /* -------------------------- Save progress /5s --------------------------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.duration) return;
      if (video.paused && video.currentTime < 1) return;
      fetch("/api/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          slug,
          episode,
          position: video.currentTime,
          duration: video.duration,
        }),
      }).catch(() => {});
    }, 5000);
    return () => window.clearInterval(id);
  }, [slug, episode]);

  /* ---------------------------- Fullscreen -------------------------------- */
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  }, []);

  /* ---------------------------- Controls --------------------------------- */
  const hideTimerRef = useRef<number | null>(null);
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, 3000);
  }, []);
  useEffect(() => () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min((v.duration || 0) - 0.1, v.currentTime + delta));
    setSeekFeedback(delta < 0 ? "back" : "fwd");
    window.setTimeout(() => setSeekFeedback(null), 500);
  }, []);

  /* ---------------------------- Gestures --------------------------------- */
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const onSurfacePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const last = lastTapRef.current;
    if (last && now - last.time < 300 && Math.abs(x - last.x) < 40) {
      const side = x < rect.width / 2 ? -10 : 10;
      seekBy(side);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x };
      window.setTimeout(() => {
        if (lastTapRef.current && lastTapRef.current.time === now) {
          togglePlay();
          lastTapRef.current = null;
        }
      }, 280);
    }
    showControls();
  };

  /* ---------------------------- Keyboard --------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          seekBy(-10);
          break;
        case "ArrowRight":
          seekBy(10);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
          break;
      }
      showControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen, showControls]);

  const epNum = Number(episode);
  const canPrev = epNum > 1;
  const canNext = epNum < totalEpisodes;

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden bg-black"
      onMouseMove={showControls}
      onMouseLeave={() =>
        videoRef.current && !videoRef.current.paused && setControlsVisible(false)
      }
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        className="h-full w-full bg-black"
        onClick={(e) => e.preventDefault()}
      />

      {/* Gesture surface (below controls) */}
      <div
        className="absolute inset-0"
        onPointerUp={onSurfacePointerUp}
      />

      {/* Loading spinner */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/70" />
        </div>
      )}

      {/* Seek feedback */}
      <AnimatePresence>
        {seekFeedback && (
          <motion.div
            key={seekFeedback}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "pointer-events-none absolute inset-y-0 flex w-1/2 items-center justify-center",
              seekFeedback === "back" ? "left-0" : "right-0",
            )}
          >
            <div className="glass-strong rounded-full px-4 py-2 text-sm font-semibold text-white">
              {seekFeedback === "back" ? "-10s" : "+10s"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prev/Next overlay */}
      {canPrev && controlsVisible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChangeEpisode(epNum - 1);
          }}
          className="glass absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full p-2 text-white hover:bg-white/10"
          aria-label="Previous episode"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {canNext && controlsVisible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChangeEpisode(epNum + 1);
          }}
          className="glass absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full p-2 text-white hover:bg-white/10"
          aria-label="Next episode"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Controls */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-b from-black/50 via-transparent to-black/70"
          >
            {/* Top */}
            <div className="pointer-events-auto flex items-center gap-3 p-3 sm:p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white sm:text-base">
                  {title}
                </p>
                <p className="text-xs text-white/60">Tập {episode}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ServerSelector
                  servers={servers}
                  value={serverId}
                  onChange={setServerId}
                />
              </div>
            </div>

            {/* Center play/pause tap target */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="pointer-events-auto mx-auto grid h-16 w-16 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:scale-110 hover:bg-black/60"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="h-7 w-7 fill-current" />
              )}
            </button>

            {/* Bottom */}
            <div className="pointer-events-auto space-y-2 p-3 sm:p-4">
              <SeekBar
                current={currentTime}
                duration={duration}
                buffered={buffered}
                onSeek={(t) => {
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
              />
              <div className="flex items-center gap-2 text-white">
                <button
                  onClick={togglePlay}
                  className="rounded-md p-1.5 hover:bg-white/10"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </button>

                <VolumeControl
                  muted={muted}
                  volume={volume}
                  onToggleMute={() => {
                    if (videoRef.current)
                      videoRef.current.muted = !videoRef.current.muted;
                  }}
                  onVolume={(v) => {
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                    }
                  }}
                />

                <span className="text-xs tabular-nums text-white/80">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <QualityMenu
                    levels={levels}
                    current={currentLevel}
                    open={qualityOpen}
                    onOpenChange={setQualityOpen}
                    onSelect={(idx) => {
                      if (hlsRef.current) hlsRef.current.currentLevel = idx;
                      setCurrentLevel(idx);
                      setQualityOpen(false);
                    }}
                  />
                  <button
                    onClick={() => setEpisodePanelOpen(true)}
                    className="flex items-center gap-1.5 rounded-md p-1.5 text-sm hover:bg-white/10"
                    aria-label="Episodes"
                  >
                    <ListVideo className="h-5 w-5" />
                    <span className="hidden sm:inline">Tập</span>
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="rounded-md p-1.5 hover:bg-white/10"
                    aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? (
                      <Minimize className="h-5 w-5" />
                    ) : (
                      <Maximize className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EpisodePanel
        open={episodePanelOpen}
        onClose={() => setEpisodePanelOpen(false)}
        currentEpisode={epNum}
        totalEpisodes={totalEpisodes}
        servers={servers}
        currentServer={serverId}
        onSelectEpisode={(n) => {
          setEpisodePanelOpen(false);
          onChangeEpisode(n);
        }}
        onSelectServer={setServerId}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-controls                                                              */
/* -------------------------------------------------------------------------- */

function SeekBar({
  current,
  duration,
  buffered,
  onSeek,
}: {
  current: number;
  duration: number;
  buffered: number;
  onSeek: (t: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  const handle = (clientX: number) => {
    const el = ref.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
    onSeek((x / rect.width) * duration);
  };

  return (
    <div
      ref={ref}
      className="group relative h-4 cursor-pointer"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        handle(e.clientX);
      }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverX(e.clientX - rect.left);
        if (e.buttons === 1) handle(e.clientX);
      }}
      onPointerLeave={() => setHoverX(null)}
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20 transition group-hover:h-1.5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/40"
          style={{ width: `${bufPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow opacity-0 transition group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
      {hoverX !== null && ref.current && duration > 0 && (
        <div
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white"
          style={{ left: hoverX }}
        >
          {formatTime((hoverX / ref.current.clientWidth) * duration)}
        </div>
      )}
    </div>
  );
}

function VolumeControl({
  muted,
  volume,
  onToggleMute,
  onVolume,
}: {
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="group flex items-center">
      <button
        onClick={onToggleMute}
        className="rounded-md p-1.5 hover:bg-white/10"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted || volume === 0 ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(e) => onVolume(Number(e.target.value))}
        className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-primary group-hover:block"
        aria-label="Volume"
      />
    </div>
  );
}

function QualityMenu({
  levels,
  current,
  open,
  onOpenChange,
  onSelect,
}: {
  levels: { index: number; height: number; bitrate: number }[];
  current: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-1 rounded-md p-1.5 text-sm hover:bg-white/10"
        aria-label="Quality"
      >
        <Settings className="h-5 w-5" />
        <span className="hidden sm:inline">
          {current === -1
            ? "Auto"
            : levels.find((l) => l.index === current)?.height + "p" || "Auto"}
        </span>
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-40 rounded-lg border border-white/10 bg-black/90 p-1 text-sm text-white shadow-xl backdrop-blur">
          <button
            onClick={() => onSelect(-1)}
            className={cn(
              "block w-full rounded px-3 py-1.5 text-left hover:bg-white/10",
              current === -1 && "text-primary",
            )}
          >
            Auto
          </button>
          {levels
            .slice()
            .sort((a, b) => b.height - a.height)
            .map((l) => (
              <button
                key={l.index}
                onClick={() => onSelect(l.index)}
                className={cn(
                  "block w-full rounded px-3 py-1.5 text-left hover:bg-white/10",
                  current === l.index && "text-primary",
                )}
              >
                {l.height}p
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function ServerSelector({
  servers,
  value,
  onChange,
}: {
  servers: ServerSource[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="glass flex items-center gap-1 rounded-full p-1">
      {servers.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium text-white transition",
            value === s.id
              ? "bg-primary text-primary-foreground"
              : "hover:bg-white/10",
          )}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  EpisodePanel — slide-up bottom sheet                                      */
/* -------------------------------------------------------------------------- */

export function EpisodePanel({
  open,
  onClose,
  currentEpisode,
  totalEpisodes,
  servers,
  currentServer,
  onSelectEpisode,
  onSelectServer,
}: {
  open: boolean;
  onClose: () => void;
  currentEpisode: number;
  totalEpisodes: number;
  servers: ServerSource[];
  currentServer: string;
  onSelectEpisode: (ep: number) => void;
  onSelectServer: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-30 bg-black/60"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="glass-strong absolute inset-x-0 bottom-0 z-40 max-h-[70%] overflow-y-auto rounded-t-2xl p-4"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-white">
                Danh sách tập
              </h3>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-white/60">
                Server
              </p>
              <div className="flex flex-wrap gap-2">
                {servers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelectServer(s.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium text-white transition",
                      currentServer === s.id
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/15 hover:bg-white/10",
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-white/60">
                Tập ({totalEpisodes})
              </p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                {Array.from({ length: totalEpisodes }).map((_, i) => {
                  const ep = i + 1;
                  const active = ep === currentEpisode;
                  return (
                    <button
                      key={ep}
                      onClick={() => onSelectEpisode(ep)}
                      className={cn(
                        "rounded-lg py-2 text-sm font-semibold transition",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 text-white hover:bg-white/10",
                      )}
                    >
                      {ep}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/*  WatchActions                                                              */
/* -------------------------------------------------------------------------- */

export function WatchActions({ slug }: { slug: string }) {
  const [fav, setFav] = useState(false);
  const [watchlist, setWatchlist] = useState(false);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setFav(localStorage.getItem(`fav:${slug}`) === "1");
      setWatchlist(localStorage.getItem(`wl:${slug}`) === "1");
      setLiked(localStorage.getItem(`like:${slug}`) === "1");
    } catch {}
  }, [slug]);

  const persist = (key: string, value: boolean) => {
    try {
      if (value) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {}
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const Btn = ({
    active,
    onClick,
    icon: Icon,
    label,
    activeClass,
  }: {
    active: boolean;
    onClick: () => void;
    icon: typeof Heart;
    label: string;
    activeClass: string;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl px-4 py-2.5 text-xs font-medium transition",
        "text-foreground-muted hover:bg-white/5 hover:text-foreground",
        active && activeClass,
      )}
    >
      <Icon className={cn("h-5 w-5", active && "fill-current")} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="glass flex items-center justify-around gap-1 rounded-2xl p-1 sm:justify-start sm:gap-2">
      <Btn
        active={fav}
        onClick={() => {
          const next = !fav;
          setFav(next);
          persist(`fav:${slug}`, next);
        }}
        icon={Heart}
        label="Yêu thích"
        activeClass="text-primary"
      />
      <Btn
        active={watchlist}
        onClick={() => {
          const next = !watchlist;
          setWatchlist(next);
          persist(`wl:${slug}`, next);
        }}
        icon={Plus}
        label="Xem sau"
        activeClass="text-cyan"
      />
      <Btn
        active={liked}
        onClick={() => {
          const next = !liked;
          setLiked(next);
          persist(`like:${slug}`, next);
        }}
        icon={ThumbsUp}
        label="Thích"
        activeClass="text-gold"
      />
      <button
        onClick={share}
        className="flex flex-col items-center gap-1 rounded-xl px-4 py-2.5 text-xs font-medium text-foreground-muted transition hover:bg-white/5 hover:text-foreground"
      >
        <Share2 className="h-5 w-5" />
        <span>{copied ? "Đã copy" : "Chia sẻ"}</span>
      </button>
    </div>
  );
}
