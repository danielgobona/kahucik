"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

function subscribe(onStoreChange: () => void) {
  const id = setInterval(onStoreChange, 250);
  return () => clearInterval(id);
}

function remainingSeconds(deadline: number | null) {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil(deadline - Date.now() / 1000));
}

export function GameTimer({
  deadline,
  className,
}: {
  deadline: number | null;
  className?: string;
}) {
  const remaining = useSyncExternalStore(
    subscribe,
    () => remainingSeconds(deadline),
    () => 0,
  );

  if (!deadline) return null;

  const urgent = remaining <= 5;

  return (
    <div
      className={cn(
        "inline-flex min-w-[4rem] items-center justify-center rounded-2xl px-4 py-2 text-3xl font-black tabular-nums",
        urgent ? "bg-rose-500 text-white animate-pulse" : "bg-amber-100 text-amber-900",
        className,
      )}
    >
      {remaining}s
    </div>
  );
}
