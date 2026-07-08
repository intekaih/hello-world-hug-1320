import { useEffect } from "react";

import { buildPageMeta, type PageMetaInput } from "@/lib/page-meta";

/**
 * Client-side updater for head tags — useful when data arrives AFTER
 * initial render (e.g. React Query result) and route `head()` couldn't
 * see it yet. Keeps `<title>` and the main SEO meta tags in sync with
 * the latest data.
 *
 * Route-level SSR head still comes from `createFileRoute({ head })`.
 */
export function usePageMeta(input: PageMetaInput | null | undefined) {
  useEffect(() => {
    if (!input || typeof document === "undefined") return;
    const tags = buildPageMeta(input);
    const created: HTMLElement[] = [];
    const prevTitle = document.title;

    for (const tag of tags) {
      if ("title" in tag) {
        document.title = tag.title;
        continue;
      }
      const attr = "name" in tag ? "name" : "property";
      const key = "name" in tag ? tag.name : tag.property;
      let el = document.head.querySelector<HTMLMetaElement>(
        `meta[${attr}="${key}"]`,
      );
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute("content", tag.content);
    }

    return () => {
      document.title = prevTitle;
      for (const el of created) el.remove();
    };
  }, [
    input?.title,
    input?.description,
    input?.image,
    input?.url,
    input?.type,
    input?.noindex,
  ]);
}
