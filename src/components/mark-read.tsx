"use client";

import { useEffect, useRef } from "react";
import { markRead } from "@/app/actions";

/**
 * Records that this parent opened the record. Runs once per mount and stays
 * silent on failure — a missed read acknowledgement is not worth interrupting
 * anyone for.
 */
export function MarkRead() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markRead().catch(() => undefined);
  }, []);

  return null;
}
