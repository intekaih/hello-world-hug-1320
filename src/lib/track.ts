/**
 * Fire-and-forget analytics hook. If no global tracker is registered,
 * the call is a no-op — safe to call from anywhere without setup.
 */
export function track(event: string, props?: Record<string, unknown>) {
  try {
    (window as unknown as { __mcTrack?: (e: string, p?: Record<string, unknown>) => void })
      .__mcTrack?.(event, props);
  } catch {
    /* ignore */
  }
}
