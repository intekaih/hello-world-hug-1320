import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Fixed banner shown when the browser reports offline.
 * Uses window online/offline events; no polling.
 */
export function OfflineBanner() {
  // Always start "online" so SSR and first client render match.
  // The real navigator.onLine is picked up in the effect below.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setOnline(navigator.onLine);
    }
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-lg pt-safe-top"
        >
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>Mất kết nối. Vui lòng kiểm tra mạng của bạn.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
