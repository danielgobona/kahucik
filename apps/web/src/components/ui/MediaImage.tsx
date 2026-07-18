"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

export function MediaImage({
  mediaId,
  alt = "",
  className,
}: {
  mediaId: string | null | undefined;
  alt?: string;
  className?: string;
}) {
  const [resolved, setResolved] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!mediaId) return;
    let cancelled = false;
    api
      .getMedia(mediaId)
      .then((m) => {
        if (!cancelled) setResolved({ id: mediaId, url: m.url });
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  const url = mediaId && resolved?.id === mediaId ? resolved.url : null;
  if (!url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={cn("max-h-48 rounded-xl object-contain", className)}
    />
  );
}
