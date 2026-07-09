import type Hls from "hls.js";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Keyboard,
  ListVideo,
  Maximize,
  Minimize,
  Monitor,
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
import { useTranslation } from "@/hooks/useTranslation";
import { useShareMovie } from "@/lib/share/use-share-movie";
import { getSharedPlayerTime, setSharedPlayerTime } from "@/lib/share/player-time-ref";
import { track } from "@/lib/track";
import { PlayerLoadingState } from "./player-loading-state";
import {
  PlayerErrorState,
  type PlayerErrorKind,
} from "./player-error-state";
import { ShortcutOverlay } from "./shortcut-overlay";
import { NextEpisodePrompt } from "./next-episode-prompt";
import { BingeBridgeOverlay } from "./binge-bridge-overlay";
import {
  markEpisodeWatchedLocal,
  useSeasonProgress,
} from "@/hooks/useSeasonProgress";
import { isAutoplayActive, usePlayerStore } from "@/store/playerStore";
import { playTick } from "@/lib/ui-sound";

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
  introEndSec?: number;
  recapEndSec?: number;
  onChangeEpisode: (ep: number) => void;
  cinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
};

/* -------------------------------------------------------------------------- */
/*  Utils                                                                     */
/* -------------------------------------------------------------------------- */

/** Ngắn, vi-friendly: "45s", "4 phút", "1h 02m" */
const formatRemainingVi = (s: number) => {
  if (!Number.isFinite(s) || s <= 0) return "0s";
  if (s < 60) return `${Math.ceil(s)}s`;
  if (s < 3600) return `${Math.ceil(s / 60)} phút`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

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
  introEndSec,
  recapEndSec,
  onChangeEpisode,
  cinemaMode = false,
  onToggleCinemaMode,
}: Props) {
  const { t } = useTranslation();
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
  const [fatalError, setFatalError] = useState<PlayerErrorKind | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [nextPromptOpen, setNextPromptOpen] = useState(false);
  const [levels, setLevels] = useState<
    { index: number; height: number; bitrate: number }[]
  >([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [seekFeedback, setSeekFeedback] = useState<null | "back" | "fwd">(null);

  // Honour ?t=<seconds> deep-links (from shared timestamped URLs).
  const initialTimeRef = useRef(
    (() => {
      if (initialTime > 0) return initialTime;
      if (typeof window === "undefined") return 0;
      const t = new URLSearchParams(window.location.search).get("t");
      const n = t ? Number(t) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    })(),
  );
  const reloadTokenRef = useRef(0);
  const [reloadToken, setReloadToken] = useState(0);
  const retryPlayback = useCallback(() => {
    setFatalError(null);
    setLoading(true);
    reloadTokenRef.current += 1;
    setReloadToken(reloadTokenRef.current);
  }, []);

  /* ---------------------------- HLS attachment ---------------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSrc) return;

    let cancelled = false;
    setLoading(true);
    setFatalError(null);

    const isNative = !!video.canPlayType("application/vnd.apple.mpegurl");

    const attach = async () => {
      // Safari (native HLS) — set src directly, no hls.js needed.
      if (isNative) {
        video.src = currentSrc;
        video.load();
        return;
      }

      const HlsMod = (await import("hls.js")).default;
      if (cancelled) return;

      // Fallback: some Chromium builds w/ MSE disabled — try native.
      if (!HlsMod.isSupported()) {
        video.src = currentSrc;
        video.load();
        return;
      }

      const hls = new HlsMod({
        enableWorker: true,
        lowLatencyMode: false,
        // Small resilience knobs
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
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

      // Auto-recover on fatal errors
      hls.on(HlsMod.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case HlsMod.ErrorTypes.NETWORK_ERROR:
            console.warn("[hls] fatal network error", data);
            setFatalError("network");
            hls.destroy();
            hlsRef.current = null;
            break;
          case HlsMod.ErrorTypes.MEDIA_ERROR:
            console.warn("[hls] fatal media error, recovering", data);
            hls.recoverMediaError();
            break;
          default:
            console.error("[hls] unrecoverable error", data);
            setFatalError("media");
            hls.destroy();
            hlsRef.current = null;
            break;
        }
      });
    };

    attach();

    return () => {
      cancelled = true;
      const hls = hlsRef.current;
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
      // Detach source so a new attach doesn't collide with old buffers.
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    };
  }, [currentSrc, reloadToken]);


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
    const onTime = () => {
      setCurrentTime(video.currentTime);
      setSharedPlayerTime(video.currentTime);
    };
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

  /* -------------------------- Save progress ------------------------------- */
  const saveProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    if (video.currentTime < 1) return;
    try {
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
    } catch {
      /* ignore */
    }
  }, [slug, episode]);

  // every 5s while playing
  useEffect(() => {
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      saveProgress();
    }, 5000);
    return () => window.clearInterval(id);
  }, [saveProgress]);

  // save on pause + before unload
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPause = () => saveProgress();
    const onUnload = () => saveProgress();
    video.addEventListener("pause", onPause);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      video.removeEventListener("pause", onPause);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      saveProgress();
    };
  }, [saveProgress]);

  // pause video when tab hidden + Zeigarnik title bridge
  useEffect(() => {
    const prevTitle = document.title;
    let bridged = false;
    const restore = () => {
      if (bridged) {
        document.title = prevTitle;
        bridged = false;
      }
    };
    const onVis = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) {
        if (!video.paused) video.pause();
        const dur = video.duration || 0;
        const cur = video.currentTime || 0;
        const remaining = dur - cur;
        if (dur > 0 && cur > 0 && remaining > 0) {
          document.title = `▶ ${formatRemainingVi(remaining)} — ${title}`;
          bridged = true;
          track("player_tab_blurred", { slug, remainingSec: Math.round(remaining) });
        }
      } else {
        const remaining = (video.duration || 0) - (video.currentTime || 0);
        restore();
        track("player_tab_returned", { slug, remainingSec: Math.round(remaining) });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      restore();
    };
  }, [slug, title]);

  /* -------------------------- Next episode prompt ------------------------- */
  useEffect(() => {
    if (!duration) return;
    const remaining = duration - currentTime;
    const canNextEp = Number(episode) < totalEpisodes;
    if (canNextEp && remaining > 0 && remaining <= 30 && !nextPromptOpen) {
      setNextPromptOpen(true);
    }
    if (remaining > 40 && nextPromptOpen) setNextPromptOpen(false);
  }, [currentTime, duration, episode, totalEpisodes, nextPromptOpen]);

  /* -------------------------- Ethical auto-next --------------------------- */
  const autoNext = usePlayerStore((s) => s.autoNext);
  const pauseAutoplayUntil = usePlayerStore((s) => s.pauseAutoplayUntil);
  const firstBingeTooltipSeen = usePlayerStore((s) => s.firstBingeTooltipSeen);
  const markBingeTooltipSeen = usePlayerStore((s) => s.markBingeTooltipSeen);
  const pauseAutoplayTonight = usePlayerStore((s) => s.pauseAutoplayTonight);
  const resumeAutoplay = usePlayerStore((s) => s.resumeAutoplay);
  const effectiveAutoNext = isAutoplayActive({ autoNext, pauseAutoplayUntil });

  // Auto-clear an expired "pause tonight" so future prompts behave normally.
  useEffect(() => {
    if (pauseAutoplayUntil && Date.now() >= pauseAutoplayUntil) {
      resumeAutoplay();
    }
  }, [pauseAutoplayUntil, resumeAutoplay]);

  // Session-only counter (never persisted) of consecutive auto-advances.
  const autoAdvanceStreakRef = useRef(0);
  const [softAskArmed, setSoftAskArmed] = useState(false);
  useEffect(() => {
    // When a new prompt opens, decide whether to escalate to a soft-ask.
    if (nextPromptOpen && effectiveAutoNext && autoAdvanceStreakRef.current >= 3) {
      setSoftAskArmed(true);
    }
    if (!nextPromptOpen) setSoftAskArmed(false);
  }, [nextPromptOpen, effectiveAutoNext]);

  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);


  /* -------------------------- Season progress ----------------------------- */
  const seasonProgress = useSeasonProgress(slug, totalEpisodes, 45);
  const [completeDismissed, setCompleteDismissed] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  useEffect(() => {
    setCompleteDismissed(false);
    setCompleteOpen(false);
  }, [slug, episode]);

  const isLastEp = Number(episode) >= totalEpisodes && totalEpisodes > 0;
  useEffect(() => {
    if (!duration || completeDismissed) return;
    const remaining = duration - currentTime;
    if (isLastEp && remaining > 0 && remaining <= 20) {
      setCompleteOpen(true);
    }
  }, [currentTime, duration, isLastEp, completeDismissed]);

  // Persist watched marker locally at ≥92% so season chip updates without auth.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!duration) return;
    const ratio = currentTime / duration;
    const key = `${slug}::${episode}`;
    if (ratio >= 0.92 && markedRef.current !== key) {
      markedRef.current = key;
      const n = Number(episode);
      if (Number.isFinite(n)) {
        markEpisodeWatchedLocal(slug, n);
        // Discrete confirmation tick — no-op unless user opted in.
        playTick();
      }
    }
  }, [currentTime, duration, slug, episode]);

  /* -------------------------- Flow-preserving skips ----------------------- */
  const SKIP_PREF_KEY = `mcc:skipIntro:${slug}`;
  const [skipPref, setSkipPref] = useState<"on" | "off" | null>(null);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SKIP_PREF_KEY);
      setSkipPref(v === "on" || v === "off" ? v : null);
    } catch {
      setSkipPref(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Determine which skip marker (if any) applies right now.
  // Only show inside [5s, endSec]; never during the next-ep prompt window.
  const skipTarget = useMemo<
    { kind: "intro" | "recap"; endSec: number } | null
  >(() => {
    if (nextPromptOpen) return null;
    if (
      typeof introEndSec === "number" &&
      currentTime >= 5 &&
      currentTime < introEndSec
    ) {
      return { kind: "intro", endSec: introEndSec };
    }
    if (
      typeof recapEndSec === "number" &&
      currentTime >= 5 &&
      currentTime < recapEndSec
    ) {
      return { kind: "recap", endSec: recapEndSec };
    }
    return null;
  }, [currentTime, introEndSec, recapEndSec, nextPromptOpen]);

  const performSkip = useCallback(() => {
    if (!skipTarget) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(v.currentTime, skipTarget.endSec);
    try {
      window.localStorage.setItem(SKIP_PREF_KEY, "on");
    } catch {
      /* ignore */
    }
    setSkipPref("on");
    track("player_skip", { slug, episode, kind: skipTarget.kind });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipTarget, slug, episode]);

  // Auto-skip when the user previously chose to skip on this series.
  const autoSkipRef = useRef<string | null>(null);
  useEffect(() => {
    if (skipPref !== "on" || !skipTarget) return;
    const key = `${episode}::${skipTarget.kind}`;
    if (autoSkipRef.current === key) return;
    autoSkipRef.current = key;
    performSkip();
  }, [skipPref, skipTarget, episode, performSkip]);
  useEffect(() => {
    autoSkipRef.current = null;
  }, [episode]);






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
    const bumpVolume = (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      const next = Math.max(0, Math.min(1, (v.muted ? 0 : v.volume) + delta));
      v.muted = next === 0;
      v.volume = next;
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t && t.isContentEditable)
      ) {
        return;
      }
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          bumpVolume(0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          bumpVolume(-0.05);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
          break;
        case "c":
        case "C":
          onToggleCinemaMode?.();
          break;
        case "?":
        case "/":
          e.preventDefault();
          setShortcutsOpen((v) => !v);
          break;
        case "s":
        case "S":
          if (skipTarget) {
            e.preventDefault();
            performSkip();
          }
          break;
        case "Escape":
          setShortcutsOpen(false);
          setEpisodePanelOpen(false);
          setQualityOpen(false);
          break;
      }
      showControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlay, seekBy, toggleFullscreen, showControls, onToggleCinemaMode, skipTarget]);

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

      {/* Loading */}
      {loading && !fatalError && <PlayerLoadingState poster={poster} />}

      {/* Fatal error surface */}
      {fatalError && (
        <PlayerErrorState
          kind={fatalError}
          servers={servers}
          currentServer={serverId}
          onRetry={retryPlayback}
          onChangeServer={(id) => {
            setFatalError(null);
            setServerId(id);
          }}
        />
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
          className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-3 text-white backdrop-blur-md transition hover:scale-110 hover:border-primary/50 hover:bg-black/60"
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
          className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-3 text-white backdrop-blur-md transition hover:scale-110 hover:border-primary/50 hover:bg-black/60"
          aria-label="Next episode"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Skip intro / recap */}
      <AnimatePresence>
        {skipTarget && (
          <motion.button
            key={skipTarget.kind}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              e.stopPropagation();
              performSkip();
            }}
            aria-label={
              skipTarget.kind === "intro"
                ? t("player.skip.introAria")
                : t("player.skip.recapAria")
            }
            className="glass-strong pointer-events-auto absolute bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_rgba(0,0,0,0.6)] transition hover:border-primary/40 hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:bottom-28"
          >
            {skipTarget.kind === "intro"
              ? t("player.skip.intro")
              : t("player.skip.recap")}
            <kbd
              aria-hidden
              className="rounded border border-white/25 bg-white/10 px-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-white/75"
            >
              S
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>



      {/* Controls */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-b from-black/60 via-transparent to-black/80"
          >
            {/* Top */}
            <div className="pointer-events-auto flex items-center gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/90">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_oklch(0.68_0.24_25)]" />
                  Live · EP {String(Number(episode) || 1).padStart(2, "0")}
                </div>
                <p className="mt-1 truncate font-display text-base font-semibold text-white sm:text-lg">
                  {title}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {totalEpisodes > 1 && (
                  <div
                    className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/85 backdrop-blur-md sm:inline-flex"
                    aria-label={
                      seasonProgress.isNearComplete
                        ? t("player.season.chipDone", {
                            watched: seasonProgress.watched,
                            total: seasonProgress.total,
                          })
                        : t("player.season.chip", {
                            watched: seasonProgress.watched,
                            total: seasonProgress.total,
                            hours: seasonProgress.hoursLeft,
                          })
                    }
                  >
                    <span className="text-white">
                      {seasonProgress.watched}/{seasonProgress.total}
                    </span>
                    <span className="text-white/40">·</span>
                    <span className="text-white/70">
                      {seasonProgress.isNearComplete
                        ? "✓"
                        : `~${seasonProgress.hoursLeft}h`}
                    </span>
                  </div>
                )}
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
              className="pointer-events-auto mx-auto grid h-20 w-20 place-items-center rounded-full text-white shadow-[0_10px_40px_-10px_oklch(0.68_0.24_25/0.7),0_0_60px_oklch(0.68_0.24_25/0.3)] ring-1 ring-white/25 backdrop-blur-md transition hover:scale-110 sm:h-24 sm:w-24"
              style={{ background: "var(--gradient-ember)" }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <Pause className="h-8 w-8 fill-current sm:h-10 sm:w-10" />
              ) : (
                <Play className="h-8 w-8 fill-current sm:h-10 sm:w-10" />
              )}
            </button>

            {/* Bottom — floating glass bar */}
            <div className="pointer-events-auto space-y-3 p-3 sm:p-5">
              <SeekBar
                current={currentTime}
                duration={duration}
                buffered={buffered}
                onSeek={(t) => {
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
              />
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-white backdrop-blur-xl sm:gap-3 sm:px-4">
                <button
                  onClick={togglePlay}
                  className="rounded-full p-1.5 transition hover:bg-white/10"
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

                <span className="font-mono text-[11px] tabular-nums tracking-wider text-white/85">
                  <span className="text-white">{formatTime(currentTime)}</span>
                  <span className="mx-1 text-white/40">/</span>
                  <span className="text-white/60">{formatTime(duration)}</span>
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
                    className="flex items-center gap-1.5 rounded-full p-1.5 text-sm transition hover:bg-white/10"
                    aria-label={t("player.controls.episodes")}
                  >
                    <ListVideo className="h-5 w-5" />
                    <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] sm:inline">
                      {t("player.controls.episodesShort")}
                    </span>
                  </button>
                  {onToggleCinemaMode && (
                    <button
                      onClick={onToggleCinemaMode}
                      className={cn(
                        "hidden rounded-full p-1.5 transition hover:bg-white/10 sm:inline-flex",
                        cinemaMode && "text-primary",
                      )}
                      aria-label={t("player.controls.cinemaMode")}
                      aria-pressed={cinemaMode}
                    >
                      <Monitor className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setSettingsSheetOpen(true)}
                    className="rounded-full p-1.5 transition hover:bg-white/10"
                    aria-label={t("player.settings.title")}
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShortcutsOpen(true)}
                    className="hidden rounded-full p-1.5 transition hover:bg-white/10 sm:inline-flex"
                    aria-label={t("player.controls.shortcuts")}
                  >
                    <Keyboard className="h-5 w-5" />
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="rounded-full p-1.5 transition hover:bg-white/10"
                    aria-label={
                      isFullscreen
                        ? t("player.controls.exitFullscreen")
                        : t("player.controls.fullscreen")
                    }
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

      <NextEpisodePrompt
        visible={nextPromptOpen && canNext}
        seconds={Math.max(1, Math.round(duration - currentTime))}
        nextEpisodeNumber={epNum + 1}
        posterUrl={poster}
        autoAdvance={effectiveAutoNext}
        softAsk={softAskArmed}
        showTooltip={effectiveAutoNext && !firstBingeTooltipSeen}
        onTooltipSeen={markBingeTooltipSeen}
        onOpenSettings={() => setSettingsSheetOpen(true)}
        onCancel={() => {
          autoAdvanceStreakRef.current = 0;
          setNextPromptOpen(false);
        }}
        onPlayNow={() => {
          autoAdvanceStreakRef.current = 0;
          setNextPromptOpen(false);
          onChangeEpisode(epNum + 1);
        }}
        onAutoAdvance={() => {
          autoAdvanceStreakRef.current += 1;
          setNextPromptOpen(false);
          onChangeEpisode(epNum + 1);
        }}
        onContinueAutoplay={() => {
          autoAdvanceStreakRef.current = 0;
          setSoftAskArmed(false);
        }}
        onPauseTonight={() => {
          pauseAutoplayTonight();
          autoAdvanceStreakRef.current = 0;
          setSoftAskArmed(false);
          setNextPromptOpen(false);
        }}
      />

      <PlayerSettingsSheet
        open={settingsSheetOpen}
        onClose={() => setSettingsSheetOpen(false)}
      />


      <BingeBridgeOverlay
        visible={completeOpen && isLastEp}
        slug={slug}
        title={title}
        onDismiss={() => {
          setCompleteOpen(false);
          setCompleteDismissed(true);
        }}
      />


      <ShortcutOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
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
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/15 transition-all duration-200 group-hover:h-1.5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/30"
          style={{ width: `${bufPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full shadow-[0_0_12px_oklch(0.68_0.24_25/0.7)]"
          style={{ width: `${pct}%`, background: "var(--gradient-ember)" }}
        />
      </div>
      <div
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_16px_oklch(0.68_0.24_25/0.9),0_2px_6px_rgba(0,0,0,0.5)] ring-2 ring-primary transition-opacity duration-200 group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
      {hoverX !== null && ref.current && duration > 0 && (
        <div
          className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md border border-white/15 bg-black/90 px-2 py-1 font-mono text-[10px] font-medium tabular-nums text-white backdrop-blur-md"
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
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-xl">
      {servers.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/85 transition",
            value === s.id
              ? "text-white shadow-[0_0_15px_oklch(0.68_0.24_25/0.5)]"
              : "hover:bg-white/10",
          )}
          style={value === s.id ? { background: "var(--gradient-ember)" } : undefined}
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
            className="absolute inset-x-0 bottom-0 z-40 max-h-[75%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-black/85 p-5 backdrop-blur-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/25" />
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-primary/90">
                  <span className="inline-block h-px w-5 bg-gradient-to-r from-primary to-transparent" />
                  Episodes
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  Danh sách tập
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 p-2 text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">
                Server
              </p>
              <div className="flex flex-wrap gap-2">
                {servers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelectServer(s.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium text-white transition",
                      currentServer === s.id
                        ? "border-primary/50 text-white shadow-[0_0_20px_oklch(0.68_0.24_25/0.4)]"
                        : "border-white/15 hover:border-white/30 hover:bg-white/10",
                    )}
                    style={
                      currentServer === s.id
                        ? { background: "var(--gradient-ember)" }
                        : undefined
                    }
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">
                Tập · {totalEpisodes}
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
                        "group relative overflow-hidden rounded-lg border py-2.5 font-mono text-sm font-semibold transition",
                        active
                          ? "border-primary/50 text-white shadow-[0_0_20px_oklch(0.68_0.24_25/0.4)]"
                          : "border-white/10 bg-white/5 text-white/85 hover:border-primary/40 hover:text-primary",
                      )}
                      style={
                        active
                          ? { background: "var(--gradient-ember)" }
                          : undefined
                      }
                    >
                      {String(ep).padStart(2, "0")}
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

export function WatchActions({
  slug,
  title,
  episode,
  posterUrl,
  getCurrentTime,
}: {
  slug: string;
  title?: string;
  episode?: string;
  posterUrl?: string;
  getCurrentTime?: () => number;
}) {
  const { t } = useTranslation();
  const { open: openShare } = useShareMovie();
  const [fav, setFav] = useState(false);
  const [watchlist, setWatchlist] = useState(false);
  const [liked, setLiked] = useState(false);

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

  const share = () => {
    openShare({
      title: title ?? slug,
      slug,
      posterUrl,
      timestampSeconds: getCurrentTime?.() ?? getSharedPlayerTime(),
    });
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
        <span>{t("share.actions.share")}</span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PlayerSettingsSheet — auto-next toggle + explanation                      */
/* -------------------------------------------------------------------------- */

function PlayerSettingsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const autoNext = usePlayerStore((s) => s.autoNext);
  const setAutoNext = usePlayerStore((s) => s.setAutoNext);
  const pauseUntil = usePlayerStore((s) => s.pauseAutoplayUntil);
  const resumeAutoplay = usePlayerStore((s) => s.resumeAutoplay);
  const paused = !!pauseUntil && Date.now() < pauseUntil;
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const setSoundEnabled = useUIStore((s) => s.setSoundEnabled);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/60"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-black/90 p-5 backdrop-blur-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/25" />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary/90">
                  {t("player.settings.eyebrow")}
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {t("player.settings.title")}
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label={t("common.close")}
                className="rounded-full border border-white/10 p-2 text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">
                    {t("player.settings.autoNextLabel")}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/65">
                    {t("player.settings.autoNextExplain")}
                  </p>
                  {paused && (
                    <button
                      onClick={resumeAutoplay}
                      className="mt-2 text-[11px] font-semibold text-primary hover:underline"
                    >
                      {t("player.settings.resumeNow")}
                    </button>
                  )}
                </div>
                <button
                  role="switch"
                  aria-checked={autoNext}
                  onClick={() => setAutoNext(!autoNext)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full border transition",
                    autoNext
                      ? "border-primary/40 bg-primary/70"
                      : "border-white/15 bg-white/10",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-all",
                      autoNext ? "left-[22px]" : "left-[2px]",
                    )}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

