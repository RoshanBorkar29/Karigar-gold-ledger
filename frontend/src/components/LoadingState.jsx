import React from "react";
import { Loader2 } from "lucide-react";

export default function LoadingState({ message = "Loading ledger records..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}
