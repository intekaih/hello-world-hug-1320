/**
 * Catalog entry point. Returns a live CatalogSource based on env:
 *   - `KKPHIM_API_BASE` (or `USE_KKPHIM=1`) → KKPhimSource
 *   - otherwise                             → MockSource
 *
 * Safe to import from server code (TSS API routes, MCP tools). Both sources
 * are pure JS so top-level import in shared modules is fine.
 */
import { KKPhimSource } from "./kkphim-source";
import { MockSource } from "./mock-source";
import type { CatalogSource } from "./source";

let cached: CatalogSource | null = null;

export function getCatalog(): CatalogSource {
  if (cached) return cached;
  const env =
    (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {};
  const useKk = Boolean(env.KKPHIM_API_BASE) || env.USE_KKPHIM === "1";
  cached = useKk ? KKPhimSource : MockSource;
  return cached;
}

export * from "./source";
export { KKPhimSource, MockSource };
