import React, { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

/**
 * Persistent OfflineBanner displayed when network connectivity is lost.
 * Calm, clear warning.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-status-problem-tint border-b border-status-problem/20 px-4 py-2 text-xs font-medium text-status-problem flex items-center justify-center gap-2"
    >
      <WifiOff className="w-4 h-4 shrink-0 stroke-[2]" />
      <span>You are offline. Entries will not be saved until you reconnect.</span>
    </div>
  );
}
