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
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaId) {
      setUrl(null);
      return;
    }
    api
      .getMedia(mediaId)
      .then((m) => setUrl(m.url))
      .catch(() => setUrl(null));
  }, [mediaId]);

  if (!mediaId || !url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={cn("max-h-48 rounded-xl object-contain", className)}
    />
  );
}
