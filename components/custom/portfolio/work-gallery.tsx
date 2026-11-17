"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "@/components/custom/editorial.module.css";

export function WorkGallery({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let destination = track.scrollLeft;
    let frame = 0;
    let settle: number | undefined;
    let suppressClick = false;
    let drag: {
      id: number; x: number; start: number; lastX: number; lastTime: number;
      velocity: number; active: boolean;
    } | null = null;
    const max = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const clamp = (position: number) => Math.max(0, Math.min(max(), position));

    const advance = () => {
      frame = 0;
      destination = clamp(destination);
      const remaining = destination - track.scrollLeft;
      if (Math.abs(remaining) < 4 || motion.matches) {
        track.scrollLeft = destination;
        return;
      }
      track.scrollLeft += remaining * 0.16;
      frame = requestAnimationFrame(advance);
    };

    const move = (position: number) => {
      destination = clamp(position);
      if (!frame) frame = requestAnimationFrame(advance);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onScroll = () => {
      track.dataset.moving = "";
      window.clearTimeout(settle);
      settle = window.setTimeout(() => { delete track.dataset.moving; }, 100);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || !event.cancelable ||
          Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1;
      const position = frame ? destination : track.scrollLeft;
      const next = clamp(position + event.deltaY * unit);
      if (next === position) return;
      event.preventDefault();
      move(next);
    };

    const onPointerDown = (event: PointerEvent) => {
      stop();
      suppressClick = false;
      if (event.pointerType !== "mouse" || event.button !== 0 || max() <= 1) return;
      drag = {
        id: event.pointerId, x: event.clientX, start: track.scrollLeft,
        lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, active: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const delta = drag.x - event.clientX;
      if (!drag.active && Math.abs(delta) <= 6) return;
      if (!drag.active) {
        drag.active = true;
        suppressClick = true;
        track.setPointerCapture(event.pointerId);
        track.dataset.dragging = "";
      }
      drag.velocity = (drag.lastX - event.clientX) / Math.max(8, event.timeStamp - drag.lastTime);
      drag.lastX = event.clientX;
      drag.lastTime = event.timeStamp;
      track.scrollLeft = clamp(drag.start + delta);
    };

    const endDrag = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const finished = drag;
      drag = null;
      if (finished.active) {
        if (track.hasPointerCapture(finished.id)) track.releasePointerCapture(finished.id);
        delete track.dataset.dragging;
        if (event.type === "pointerup" && event.timeStamp - finished.lastTime < 90 && !motion.matches) {
          move(track.scrollLeft + Math.max(-500, Math.min(500, finished.velocity * 145)));
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0 || !(event.target instanceof Node) || !track.contains(event.target)) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const preventImageDrag = (event: DragEvent) => event.preventDefault();

    track.addEventListener("wheel", onWheel, { passive: false });
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("click", onClick, true);
    track.addEventListener("dragstart", preventImageDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      stop();
      window.clearTimeout(settle);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("lostpointercapture", endDrag);
      window.removeEventListener("click", onClick, true);
      track.removeEventListener("dragstart", preventImageDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  return (
    <div ref={trackRef} className={styles.workGallery} tabIndex={0} role="region" aria-label="프로젝트 갤러리">
      {children}
    </div>
  );
}
