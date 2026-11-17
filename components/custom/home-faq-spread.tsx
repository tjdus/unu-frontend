"use client";

import { useRef, type ReactNode } from "react";
import { useReplayInView } from "./use-replay-in-view";
import styles from "./home-faq-spread.module.css";

/**
 * FAQ rows reveal from the middle outward whenever the list comes into view.
 */
export function HomeFaqSpread({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useReplayInView(ref, 0, "140px 0px");

  return (
    <div ref={ref} className={`${styles.list} ${className ?? ""}`}>
      {children}
    </div>
  );
}
