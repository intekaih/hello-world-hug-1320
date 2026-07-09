# Wave 2 — BE Integration: Detail + Auth + History

## Status

- ✅ **Wave 1**: Home page → real BE (shipped)
- 🚧 **Wave 2.1**: Detail page (`/phim/:slug` + `/xem/:slug/tap-:ep`)
- 🚧 **Wave 2.2**: Auth (login/register/logout/me)
- 🚧 **Wave 2.3**: History (Continue Watching)

## Prompts

| File | Mục tiêu | Thời gian ước tính |
|------|----------|-------------------|
| [wave-2.1-detail-page.md](./wave-2.1-detail-page.md) | Movie detail + watch + related | ~30 phút |
| [wave-2.2-auth.md](./wave-2.2-auth.md) | Login/logout/me/register + auth context | ~45 phút |
| [wave-2.3-history.md](./wave-2.3-history.md) | Continue Watching + auto-save progress | ~30 phút |

## Thứ tự thực hiện

**Làm theo thứ tự 2.1 → 2.2 → 2.3** vì:
- 2.2 cần `useAuth()` cho 2.3 (Continue Watching chỉ hiển thị khi logged in)
- 2.1 không phụ thuộc vào 2.2/2.3

## Sau Wave 2

Wave 3 sẽ là:
- Search + Suggest
- Category/Country/Type browse pages
- Favorites + Watchlist
- Notifications
- Actor pages

## Quick Start

Copy nội dung file `.md` tương ứng và paste vào Lovable chat.

Hoặc dùng câu lệnh tóm tắt:

> "Implement the 3 waves in `prompts/` folder. Start with wave-2.1-detail-page.md, then 2.2-auth, then 2.3-history. Read each prompt file fully, then implement step by step. Use my existing `src/api-client/` infrastructure (base.ts with `apiFetch` + CSRF, movies.ts with `mapToCard` and `proxyImage`). Don't break Wave 1 (Home page)."

## Verification Checklist

Sau khi Lovable hoàn thành cả 3 wave:

- [ ] `/` — Home vẫn hoạt động (regression check)
- [ ] `/phim/{slug}` — Detail page render đúng từ BE
- [ ] `/xem/{slug}/tap-{ep}` — Watch page play được video
- [ ] `/login` — Login thành công, session persist
- [ ] `/history` — History page hiển thị (authed) hoặc login prompt (guest)
- [ ] Continue Watching strip — hiển thị trên home khi authed
- [ ] Watch 30s → reload page → resume từ đúng vị trí
- [ ] Logout → Continue Watching biến mất
