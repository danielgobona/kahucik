"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function GameTimer({
  deadline,
  className,
}: {
  deadline: number | null;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadline) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil(deadline - Date.now() / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

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
