/**
 * Tiny module-level snapshot for the current player's playback time.
 * Lets sibling components (e.g. WatchActions' share button) build a
 * timestamped share URL without prop-drilling a ref through the tree.
 */
let currentSeconds = 0;
export function setSharedPlayerTime(sec: number) {
  currentSeconds = Number.isFinite(sec) && sec > 0 ? sec : 0;
}
export function getSharedPlayerTime() {
  return currentSeconds;
}
