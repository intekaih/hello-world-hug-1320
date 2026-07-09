/**
 * Global "active hover preview" registry — ensures at most ONE trailer
 * video is playing across the whole app at a time. Cards register their
 * stop callback on mount-of-preview, and are asked to stop when another
 * card takes the slot.
 *
 * Also used by cards to coordinate the "tap-first-preview / tap-again
 * navigate" gesture on coarse pointers: only one previewing card at a
 * time keeps the UI predictable.
 */

type StopFn = () => void;

let current: { id: symbol; stop: StopFn } | null = null;

export function claimPreviewSlot(stop: StopFn): symbol {
  const id = Symbol("preview");
  if (current && current.id !== id) {
    try {
      current.stop();
    } catch {
      /* ignore */
    }
  }
  current = { id, stop };
  return id;
}

export function releasePreviewSlot(id: symbol): void {
  if (current?.id === id) current = null;
}

export function hasActivePreview(): boolean {
  return current !== null;
}
