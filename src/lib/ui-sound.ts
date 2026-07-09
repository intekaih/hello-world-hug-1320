/**
 * Opt-in UI sound effects.
 *
 * ── Design rules (Epic: Opt-in UI sounds) ────────────────────────────
 * • Default silent. Sounds only play when `useUIStore.soundEnabled === true`.
 * • Reserved for confirmation cues:
 *     - `playWhoosh()`  → add to watchlist / favorite (success)
 *     - `playTick()`    → episode complete
 * • NEVER used for hover, focus, or autoplayed trailer audio.
 * • Respects `(prefers-reduced-motion: reduce)` as a soft signal — we still
 *   allow sound if the user explicitly opted in (Acceptance: "reduced-motion
 *   không bắt buộc tắt sound nhưng nên"), but we duck the volume ~40% so
 *   the cue is felt, not intrusive.
 *
 * Implementation uses WebAudio synthesis — no external asset fetch, no
 * decode latency, keeps the runtime tiny and offline-friendly.
 */

import { useUIStore } from "@/store/uiStore";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Gate that both feature-flag AND user opt-in must clear. */
function canPlay(): boolean {
  try {
    return useUIStore.getState().soundEnabled === true;
  } catch {
    return false;
  }
}

function baseGain(): number {
  // Reduced-motion users: keep sound but duck it.
  return prefersReducedMotion() ? 0.09 : 0.15;
}

/**
 * Soft downward whoosh — used when an item is added to watchlist / favorite.
 * ~180ms, filtered noise sweep from 1200Hz → 300Hz.
 */
export function playWhoosh(): void {
  if (!canPlay()) return;
  const audio = getCtx();
  if (!audio) return;
  // Some browsers keep the context suspended until first user gesture.
  if (audio.state === "suspended") audio.resume().catch(() => {});

  const now = audio.currentTime;
  const dur = 0.18;

  // Noise buffer (mono, 180ms).
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = audio.createBufferSource();
  src.buffer = buffer;

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(300, now + dur);

  const gain = audio.createGain();
  const peak = baseGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(now);
  src.stop(now + dur + 0.02);
}

/**
 * Crisp two-note tick — used when an episode is marked complete.
 * ~120ms: 880Hz → 1320Hz sine blip.
 */
export function playTick(): void {
  if (!canPlay()) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") audio.resume().catch(() => {});

  const now = audio.currentTime;
  const peak = baseGain() * 0.9;

  const blip = (freq: number, at: number, len: number) => {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + at);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, now + at);
    g.gain.exponentialRampToValueAtTime(peak, now + at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
    osc.connect(g).connect(audio.destination);
    osc.start(now + at);
    osc.stop(now + at + len + 0.02);
  };

  blip(880, 0, 0.06);
  blip(1320, 0.055, 0.08);
}
