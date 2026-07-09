import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { AppOnboardingHost } from "@/components/onboarding/app-onboarding-host";

import { OfflineBanner } from "@/components/offline-banner";
import { I18nProvider } from "@/i18n";
import { ShareProvider } from "@/lib/share/use-share-movie";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or was moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}


function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page failed to load. You can retry or return home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retry
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Home
          </a>
        </div>

      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "movieCC — Xem phim online Vietsub, Thuyết minh chất lượng cao" },
      {
        name: "description",
        content:
          "movieCC — Kho phim bộ, phim lẻ, anime Vietsub & thuyết minh cập nhật mỗi ngày. Xem online mượt trên mọi thiết bị.",
      },
      { name: "theme-color", content: "#0a0a12" },
      { property: "og:title", content: "movieCC — Xem phim online Vietsub, Thuyết minh chất lượng cao" },
      {
        property: "og:description",
        content:
          "movieCC — Kho phim bộ, phim lẻ, anime Vietsub & thuyết minh cập nhật mỗi ngày. Xem online mượt trên mọi thiết bị.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "movieCC — Xem phim online Vietsub, Thuyết minh chất lượng cao" },
      { name: "twitter:description", content: "movieCC — Kho phim bộ, phim lẻ, anime Vietsub & thuyết minh cập nhật mỗi ngày. Xem online mượt trên mọi thiết bị." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/618bf36f-888c-4d80-be71-d9181fe0b6cb/id-preview-c4d10bf4--230020e9-0874-4d6d-8c7c-8dbd412a279e.lovable.app-1783569257946.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/618bf36f-888c-4d80-be71-d9181fe0b6cb/id-preview-c4d10bf4--230020e9-0874-4d6d-8c7c-8dbd412a279e.lovable.app-1783569257946.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      // Preconnect to image CDNs used by movie posters/backdrops (LCP path).
      { rel: "preconnect", href: "https://phimimg.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://wsrv.nl", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://phimapi.com" },
      { rel: "dns-prefetch", href: "https://image.tmdb.org" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..900,0..100&family=Geist:wght@300..800&family=Geist+Mono:wght@400;500;600&display=swap",
      },

    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Prime the BE-issued CSRF cookie (double-submit) before any mutation.
    // Falls back silently in dev if BE isn't up yet.
    import("@/api-client/csrf").then((m) => m.ensureBeCsrfToken().catch(() => {}));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <OfflineBanner />
        <AuthProvider>
          <ShareProvider>
            <AppShell />
          </ShareProvider>
          <AppOnboardingHost />
          <Toaster />
        </AuthProvider>
      </I18nProvider>

    </QueryClientProvider>
  );
}




