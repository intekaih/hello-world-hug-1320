import { Link } from "@tanstack/react-router";
import { ChevronDown, Compass, Film, Globe2, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CATEGORIES: { label: string; slug: string }[] = [
  { label: "Hành động", slug: "hanh-dong" },
  { label: "Phiêu lưu", slug: "phieu-luu" },
  { label: "Chính kịch", slug: "chinh-kich" },
  { label: "Kinh dị", slug: "kinh-di" },
  { label: "Hài", slug: "hai" },
  { label: "Tình cảm", slug: "tinh-cam" },
  { label: "Khoa học viễn tưởng", slug: "khoa-hoc-vien-tuong" },
  { label: "Bí ẩn", slug: "bi-an" },
  { label: "Tội phạm", slug: "toi-pham" },
  { label: "Lịch sử", slug: "lich-su" },
  { label: "Hoạt hình", slug: "hoat-hinh" },
  { label: "Tài liệu", slug: "tai-lieu" },
];

const COUNTRIES: { label: string; slug: string }[] = [
  { label: "Mỹ", slug: "my" },
  { label: "Hàn Quốc", slug: "han-quoc" },
  { label: "Nhật Bản", slug: "nhat-ban" },
  { label: "Trung Quốc", slug: "trung-quoc" },
  { label: "Việt Nam", slug: "viet-nam" },
  { label: "Anh", slug: "anh" },
  { label: "Pháp", slug: "phap" },
  { label: "Tây Ban Nha", slug: "tay-ban-nha" },
  { label: "Ấn Độ", slug: "an-do" },
  { label: "Thái Lan", slug: "thai-lan" },
];

const YEARS = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));

type TriggerProps = {
  label: string;
  icon: React.ReactNode;
};

function Trigger({ label, icon }: TriggerProps) {
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-foreground/80 transition hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground"
        aria-label={label}
      >
        <span className="text-foreground/60">{icon}</span>
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60 transition group-data-[state=open]:rotate-180" />
      </button>
    </PopoverTrigger>
  );
}

function Panel({
  title,
  items,
  paramKey,
  columns = 3,
}: {
  title: string;
  items: { label: string; slug: string }[];
  paramKey: "category" | "country" | "year";
  columns?: number;
}) {
  return (
    <PopoverContent
      align="start"
      sideOffset={8}
      className={cn(
        "w-[min(92vw,640px)] rounded-2xl border-foreground/10 bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur-xl",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
          {title}
        </p>
        <Link
          to="/browse/$type"
          params={{ type: "phim-le" }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Xem tất cả →
        </Link>
      </div>
      <div
        className={cn(
          "grid gap-1",
          columns === 3 && "grid-cols-2 sm:grid-cols-3",
          columns === 4 && "grid-cols-3 sm:grid-cols-4",
          columns === 5 && "grid-cols-4 sm:grid-cols-5",
        )}
      >
        {items.map((it) => (
          <Link
            key={it.slug}
            to="/browse/$type"
            params={{ type: "phim-le" }}
            search={{ [paramKey]: it.slug, page: 1, sort: "newest" } as never}
            className="rounded-lg px-3 py-2 text-sm text-foreground/85 transition hover:bg-primary/10 hover:text-primary"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </PopoverContent>
  );
}

export function MegaMenu() {
  return (
    <nav
      aria-label="Danh mục"
      className="hidden items-center gap-1 md:flex"
    >
      <Link
        to="/kham-pha"
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-foreground/80 transition hover:bg-foreground/5 hover:text-foreground"
      >
        <Compass className="h-4 w-4 text-foreground/60" />
        Khám phá
      </Link>

      <Popover>
        <Trigger label="Thể loại" icon={<Film className="h-4 w-4" />} />
        <Panel title="Thể loại phim" items={CATEGORIES} paramKey="category" columns={3} />
      </Popover>

      <Popover>
        <Trigger label="Quốc gia" icon={<Globe2 className="h-4 w-4" />} />
        <Panel title="Quốc gia sản xuất" items={COUNTRIES} paramKey="country" columns={3} />
      </Popover>

      <Popover>
        <Trigger label="Năm" icon={<Calendar className="h-4 w-4" />} />
        <Panel
          title="Năm phát hành"
          items={YEARS.map((y) => ({ label: y, slug: y }))}
          paramKey="year"
          columns={5}
        />
      </Popover>
    </nav>
  );
}
