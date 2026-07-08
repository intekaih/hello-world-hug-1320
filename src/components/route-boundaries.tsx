import { Link, useRouter } from "@tanstack/react-router";
import { AlertCircle, FileQuestion, RotateCw } from "lucide-react";

/**
 * Shared per-route error UI: shows a friendly Vietnamese message and a
 * retry button that invalidates the router before resetting the boundary
 * so the loader/query actually re-runs.
 */
export function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive">
        <AlertCircle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Đã có lỗi</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        {error.message || "Không tải được nội dung này. Vui lòng thử lại."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" /> Thử lại
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

export function RouteNotFound({
  title = "Không tìm thấy nội dung",
  description = "Nội dung bạn tìm không tồn tại hoặc đã bị gỡ.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-white/5 text-foreground-muted">
        <FileQuestion className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-foreground-muted">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Về trang chủ
        </Link>
        <Link
          to="/browse"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Duyệt phim
        </Link>
      </div>
    </div>
  );
}
