import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";

/**
 * Extract a stable HTTP status if the error carries one, so we can suppress
 * expected 4xx toasts (validation, not-found) while still surfacing 5xx/network.
 */
function statusOf(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return null;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Đã có lỗi xảy ra";
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Exponential backoff: 500ms, 1s, 2s, 4s, capped at 30s.
        retry: (failureCount, error) => {
          const status = statusOf(error);
          // Don't retry client errors — they won't get better.
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only surface toasts for queries that already have rendered data
        // (background refetch failures). Initial-load errors are handled by
        // the component/route errorComponent so we don't double-notify.
        if (query.state.data === undefined) return;
        const status = statusOf(error);
        if (status && status >= 400 && status < 500) return;
        toast.error("Không tải được dữ liệu", {
          description: messageOf(error),
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const status = statusOf(error);
        if (status === 401 || status === 403) return; // handled by auth flow
        toast.error("Thao tác thất bại", {
          description: messageOf(error),
        });
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
