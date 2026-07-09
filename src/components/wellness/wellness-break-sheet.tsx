import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { todayWatchedMinutes } from "@/lib/wellness";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WellnessBreakSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  const minutes = todayWatchedMinutes();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("wellness.title")}</DialogTitle>
          <DialogDescription>
            {t("wellness.body", { m: String(minutes) })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="ghost" onClick={onClose}>{t("wellness.continue")}</Button>
          <Button onClick={onClose}>{t("wellness.break")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
