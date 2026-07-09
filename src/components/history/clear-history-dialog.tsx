import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REQUIRED = "DELETE";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ClearHistoryDialog({ open, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const matches = value.trim().toUpperCase() === REQUIRED;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("history.clear.title")}</DialogTitle>
          <DialogDescription>
            {t("history.clear.description", { word: REQUIRED })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="clear-history-confirm" className="text-sm">
            {t("history.clear.inputLabel", { word: REQUIRED })}
          </Label>
          <Input
            id="clear-history-confirm"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={REQUIRED}
            aria-describedby="clear-history-hint"
          />
          <p id="clear-history-hint" className="text-xs text-foreground/60">
            {t("history.clear.hint")}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("history.clear.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!matches}
            onClick={() => {
              if (!matches) return;
              onConfirm();
              onOpenChange(false);
            }}
          >
            {t("history.clear.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
