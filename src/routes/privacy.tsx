import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Chính sách bảo mật — movieCC" },
      { name: "description", content: "Chính sách bảo mật và quyền riêng tư của movieCC." },
      { property: "og:title", content: "Chính sách bảo mật — movieCC" },
      { property: "og:description", content: "Chính sách bảo mật và quyền riêng tư của movieCC." },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 text-foreground/80">
      <h1 className="font-display text-3xl font-bold text-foreground">Chính sách bảo mật</h1>
      <p className="text-sm text-muted-foreground">Cập nhật lần cuối: 2026</p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">1. Thông tin thu thập</h2>
        <p>Chúng tôi chỉ lưu trữ username, mật khẩu (đã mã hóa), lịch sử xem, danh sách yêu thích và theo dõi để phục vụ trải nghiệm cá nhân.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">2. Cookies & Session</h2>
        <p>movieCC dùng session cookie để duy trì đăng nhập. Không có tracking cookie bên thứ ba.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">3. Chia sẻ dữ liệu</h2>
        <p>Chúng tôi không bán, không chia sẻ dữ liệu người dùng cho bên thứ ba với bất kỳ mục đích quảng cáo nào.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">4. Quyền của bạn</h2>
        <p>Bạn có thể xóa tài khoản bất cứ lúc nào bằng cách gửi yêu cầu qua trang Phản hồi.</p>
      </section>
    </div>
  );
}
