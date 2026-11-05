import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorState({
  title = "An error occurred",
  message = "Failed to load data from server.",
  onRetry = null,
}) {
  return (
    <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-200 flex items-start gap-3 my-4">
      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-rose-300">{title}</h4>
        <p className="mt-0.5 text-xs text-rose-200/80">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-white underline underline-offset-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
