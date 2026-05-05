"use client";

import { useEffect, useRef } from "react";
import { logEvent } from "@/lib/analytics";

type TrackEventOnMountProps = {
  event: string;
  props?: Record<string, unknown>;
};

export default function TrackEventOnMount({ event, props = {} }: TrackEventOnMountProps) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    logEvent(event, props);
  }, [event, props]);

  return null;
}

