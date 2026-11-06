import React from "react";
import { SkeletonRows } from "./ui/Skeleton";

/**
 * LoadingState: renders calm skeleton rows matching table/form layouts.
 */
export default function LoadingState({ count = 4, className = "" }) {
  return (
    <div className={`py-6 px-4 bg-surface border border-border rounded my-4 ${className}`}>
      <SkeletonRows count={count} />
    </div>
  );
}
