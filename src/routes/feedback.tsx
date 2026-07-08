import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { apiPost } from "@/api-client";
import { PageHeader } from "@/components/user-lists/shared";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Phản hồi — movieCC" },
      { name: "description", content: "Gửi góp ý, báo lỗi hoặc yêu cầu phim tới đội ngũ movieCC." },
      { property: "og:title", content: "Phản hồi — movieCC" },
      { property: "og:description", content: "Gửi góp ý, báo lỗi hoặc yêu cầu phim." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const [type, setType] = useState<"bug" | "feature" | "request" | "other">("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const send = useMutation({
    mutationFn: () => apiPost("/api/feedback", { json: { type, message, email } }),
    onSuccess: () => {
      toast.success("Cảm ơn phản hồi của bạn!");
      setMessage("");
    },
    onError: () => toast.error("Gửi thất bại, vui lòng thử lại."),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Phản hồi" icon={<MessageSquare className="h-5 w-5" />} />

      <div className="glass space-y-4 rounded-2xl border border-white/5 p-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/50">Loại phản hồi</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          >
            <option value="bug">Báo lỗi</option>
            <option value="feature">Đề xuất tính năng</option>
            <option value="request">Yêu cầu phim</option>
            <option value="other">Khác</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/50">Email (tuỳ chọn)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/50">Nội dung</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            placeholder="Mô tả chi tiết..."
          />
        </label>

        <button
          onClick={() => send.mutate()}
          disabled={!message.trim() || send.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> Gửi phản hồi
        </button>
      </div>
    </div>
  );
}
