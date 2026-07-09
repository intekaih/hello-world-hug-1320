# Kế hoạch audit + fix MovieCC

Đây là request rất rộng (11 trang × 6 hạng mục). Mình sẽ **audit toàn bộ**, nhưng **chỉ fix những vấn đề có bằng chứng rõ ràng và impact cao** — không đụng vào code đang hoạt động tốt, không redesign, không đổi API, giữ nguyên cinematic identity.

## Phạm vi audit (đọc + đánh giá)

- Tokens & theme: `src/styles.css`, `themeStore`, `app-shell`
- Rails / scroll: `experience-card`, `MovieRow`, `Top10Section`, `continue-watching-immersive`, `cast-carousel`, `related-rail`, `recommendation-*`, `episode-selector`, `mood-match-rail`, `genre-cosmos`, `browse.*`
- Card / stutter: `experience-card`, `resume-experience-card`, `scene-*`, `cinematic-hero`, `movie-detail/hero`, `ambient-theater-background`, `share-sheet`, `logo-reveal`
- Watch: `player`, `cinema-mode-layout`, `next-episode-prompt`, `shortcut-overlay`
- i18n: `locales/vi.json` vs `locales/en.json` (diff key), grep hardcode trong 6 trang chính
- A11y: aria-label icon buttons, focus-visible, tap target, `<main>`

## Nguyên tắc fix (giữ nhỏ, có mục tiêu)

1. **Contrast** — chỉ chỉnh token `--muted-foreground` light-mode nếu <4.5:1, và thêm scrim/token cho text-over-image nếu thấy `text-white/60` trên poster. Không đổi màu primary/accent.
2. **Scroll jank** — `overscroll-behavior-x: contain` cho rails ngang; bỏ `preventDefault` non-passive nếu tìm thấy; disable 3D-tilt/mouse-parallax trên touch (`pointer:coarse`) và khi đang scroll.
3. **Stutter** — thay animation `width/height/box-shadow` bằng `transform/opacity`; giảm blur radius trên mobile; `content-visibility:auto` cho decorative overlays offscreen; memo hoá card list items nếu thấy re-render.
4. **Theme** — sửa `text-white`/`bg-black/xx` hardcode ở component không thuộc `.dark` scoped hero → chuyển sang token; đảm bảo light mode không vỡ.
5. **i18n** — bổ sung key thiếu (diff vi/en), quét hardcode string tại các trang list và toast; đảm bảo `changeLanguage` persist (đã có `moviecc:lang`).
6. **A11y** — thêm `aria-label` cho icon-only button thiếu, kiểm tra `<main>` single instance, tap target ≥44px cho control player.

## Không làm

- Không thêm feature/route mới, không đổi backend, MCP, i18n framework, hay store shapes.
- Không đổi palette chính (primary #E94560, gold, cyan).
- Không refactor lớn — chỉ patch tại chỗ.
- Không đụng `routeTree.gen.ts`.

## Output cuối

Báo cáo theo đúng 11 mục user yêu cầu: điểm chất lượng, số issue/fix mỗi hạng mục, files changed, remaining risks, verdict go/no-go.

## Rủi ro

- Không thể test thủ công đầy đủ trên nhiều device → dựa vào typecheck + build + đọc code.
- Một số "jank" chỉ cảm nhận được khi tương tác thật; sẽ ưu tiên fix pattern có bằng chứng trong code (non-passive listener, backdrop-filter chồng, mousemove setState).
- Nếu audit phát hiện quá nhiều issue, sẽ fix batch quan trọng nhất và list phần còn lại trong "Remaining risks" thay vì kéo dài vô hạn.
