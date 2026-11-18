"use client";

import { useEffect, useRef } from "react";
import {
  projectRingPoint,
  ringContours,
  ringHeight,
  ringLevels,
  ringPoint,
  ringSpokes,
  ringSpokeOpacity,
  ringStrokeOpacity,
  ringWidth,
} from "./people-ring-geometry";
import type { makeRingRenderer } from "./people-ring-webgl";
import styles from "./about-people.module.css";

function pointsAttribute(points: ReturnType<typeof ringPoint>[]) {
  return points.map((point) => projectRingPoint(point).map((coordinate) => coordinate.toFixed(1)).join(",")).join(" ");
}

const fallbackSpokes = ringSpokes.map(pointsAttribute);
const fallbackContours = ringContours.map(pointsAttribute);

export function PeopleRingArt({ years, selected }: { years: string[]; selected: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = Math.round((ringLevels.length - 1) * (1 - selected / Math.max(1, years.length - 1)));
  const targetRef = useRef(target);
  const requestDraw = useRef<(() => void) | null>(null);

  useEffect(() => {
    targetRef.current = target;
    requestDraw.current?.();
  }, [target]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    let renderer: ReturnType<typeof makeRingRenderer> | undefined;
    let size = { width: 0, height: 0 };
    let visible = false;
    let loading = false;
    let disposed = false;
    let contextLost = false;
    let frame = 0;

    const draw = () => {
      frame = 0;
      if (!renderer || contextLost || !size.width || !size.height) return;
      if (canvas.width !== size.width || canvas.height !== size.height) renderer.resize(size.width, size.height);
      renderer.render(targetRef.current);
      stage.dataset.renderer = "webgl";
    };

    const schedule = () => {
      if (renderer && visible && !contextLost && !frame) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      size = { width: stage.clientWidth, height: stage.clientHeight };
      if (!renderer || contextLost || !size.width || !size.height) return;
      if (frame) cancelAnimationFrame(frame);
      draw();
    };

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      if (renderer) {
        schedule();
        return;
      }
      if (loading) return;
      loading = true;

      void import("./people-ring-webgl").then(({ makeRingRenderer }) => {
        if (disposed) return;
        const theme = getComputedStyle(stage);
        renderer = makeRingRenderer(
          canvas,
          theme.getPropertyValue("--ring-line").trim(),
          theme.getPropertyValue("--ring-highlight").trim(),
        );
        resize();
      }).catch(() => {
        delete stage.dataset.renderer;
      });
    }, { rootMargin: "160px" });

    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      delete stage.dataset.renderer;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const onContextRestored = () => {
      contextLost = false;
      schedule();
    };

    const resizeObserver = new ResizeObserver(resize);
    intersectionObserver.observe(stage);
    resizeObserver.observe(stage);
    requestDraw.current = schedule;
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    return () => {
      disposed = true;
      requestDraw.current = null;
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      renderer?.dispose();
      delete stage.dataset.renderer;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
    };
  }, []);

  const selectedContour = ringContours[target];
  const [selectedX, selectedY] = projectRingPoint(selectedContour[Math.round(selectedContour.length * 0.94)]);

  return (
    <div className={styles.ringStage} style={{ aspectRatio: `${ringWidth} / ${ringHeight}` }} ref={stageRef} aria-hidden="true">
      <canvas className={styles.ringCanvas} ref={canvasRef} />
      <svg className={styles.ringSvg} viewBox={`0 0 ${ringWidth} ${ringHeight}`} preserveAspectRatio="none">
        <g className={styles.ringFallback}>
          {fallbackSpokes.map((points, index) => <polyline key={index} points={points} opacity={ringSpokeOpacity} />)}
          {fallbackContours.map((points, index) => (
            <polygon key={index} points={points} opacity={ringStrokeOpacity(index, target)} data-selected={index === target} />
          ))}
        </g>
        <g className={styles.ringMarker} key={selected}>
          <circle cx={selectedX} cy={selectedY} r="3" />
          <text x={selectedX + 2} y={selectedY - 10} textAnchor="end">{years[selected]}</text>
        </g>
      </svg>
    </div>
  );
}
