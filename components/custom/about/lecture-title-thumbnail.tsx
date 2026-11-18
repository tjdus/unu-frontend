"use client";

import { useEffect, useRef } from "react";
import type { makeLectureTitle } from "./lecture-title-webgl";
import styles from "./lecture-title-thumbnail.module.css";

export function LectureTitleThumbnail({ title }: { title: string }) {
  const artRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const art = artRef.current;
    const canvas = canvasRef.current;
    if (!art || !canvas) return;

    const canTilt = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const phase = Array.from(title).reduce((value, char) => value + (char.codePointAt(0) ?? 0), 0) % 31 * 0.2;
    let thumbnail: ReturnType<typeof makeLectureTitle> | undefined;
    let visible = false;
    let loading = false;
    let disposed = false;
    let frame = 0;
    let lastDraw = -Infinity;
    let pitch = 0;
    let yaw = 0;
    let targetPitch = 0;
    let targetYaw = 0;

    const draw = (now: number) => {
      frame = 0;
      if (!thumbnail || !visible) return;
      const idle = !reduceMotion.matches;
      if (idle && now - lastDraw < 32) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastDraw = now;
      const atRest = Math.abs(targetPitch - pitch) + Math.abs(targetYaw - yaw) < 0.003;
      pitch = atRest || !idle ? targetPitch : pitch + (targetPitch - pitch) * 0.22;
      yaw = atRest || !idle ? targetYaw : yaw + (targetYaw - yaw) * 0.22;
      const time = now * 0.001 + phase;
      if (!thumbnail.render(
        pitch + (idle ? Math.sin(time * 0.95) * 0.045 : 0),
        yaw + (idle ? Math.sin(time * 0.82 + 1) * 0.065 : 0),
        idle ? Math.sin(time * 1.1) * 2.8 : 0,
      )) {
        delete art.dataset.renderer;
        return;
      }
      if (!art.dataset.renderer) art.dataset.renderer = "webgl";
      if (idle) frame = requestAnimationFrame(draw);
    };

    const schedule = () => {
      if (visible && thumbnail && !frame) frame = requestAnimationFrame(draw);
    };

    const inView = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        pitch = yaw = targetPitch = targetYaw = 0;
        return;
      }
      if (thumbnail) {
        schedule();
      } else if (!loading) {
        loading = true;
        const style = getComputedStyle(art);
        const family = style.fontFamily;
        const color = style.color;
        void Promise.all([
          import("./lecture-title-webgl"),
          document.fonts.load(`700 108px ${family}`, title),
        ]).then(([module]) => {
          if (disposed) return;
          thumbnail = module.makeLectureTitle(canvas, title, family, color);
          schedule();
        }).catch(() => {
          delete art.dataset.renderer;
        });
      }
    });

    const onMove = (event: PointerEvent) => {
      if (!canTilt.matches || event.pointerType !== "mouse") return;
      const rect = art.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      targetPitch = -(event.clientY - rect.top - rect.height / 2) / rect.height * 0.26;
      targetYaw = (event.clientX - rect.left - rect.width / 2) / rect.width * 0.38;
      schedule();
    };
    const onLeave = () => {
      targetPitch = targetYaw = 0;
      schedule();
    };

    inView.observe(art);
    art.addEventListener("pointermove", onMove);
    art.addEventListener("pointerleave", onLeave);
    canTilt.addEventListener("change", onLeave);
    reduceMotion.addEventListener("change", onLeave);
    return () => {
      disposed = true;
      inView.disconnect();
      if (frame) cancelAnimationFrame(frame);
      thumbnail?.dispose();
      delete art.dataset.renderer;
      art.removeEventListener("pointermove", onMove);
      art.removeEventListener("pointerleave", onLeave);
      canTilt.removeEventListener("change", onLeave);
      reduceMotion.removeEventListener("change", onLeave);
    };
  }, [title]);

  return (
    <div ref={artRef} className={styles.art} lang={/\p{Script=Hangul}/u.test(title) ? "ko" : "en"} aria-hidden="true">
      <span className={styles.fallback}>{title}</span>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
