"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { EditorialBlogRow } from "@/components/custom/editorial";
import styles from "@/components/custom/editorial.module.css";
import type { BlogPost } from "@/lib/interfaces/blog";

const BEND = 0.1;
const MOTION_DURATION = 1000;
const FIELD_GUARD = 1;
const FIELD_SPAN = 1 + 2 * FIELD_GUARD;
let displacementTexture: string | undefined;

function getDisplacementTexture() {
  if (displacementTexture) return displacementTexture;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixels = context.createImageData(size, size);
  // Extend the field beyond the viewport so a scroll frame cannot expose a hard map seam.
  for (let row = 0; row < size; row++) {
    const y = ((row + 0.5) / size * 2 - 1) * FIELD_SPAN;
    for (let column = 0; column < size; column++) {
      const x = ((column + 0.5) / size * 2 - 1) * FIELD_SPAN;
      const radiusSquared = x * x + y * y;
      const offset = (row * size + column) * 4;
      pixels.data[offset] = (0.5 - x * radiusSquared / 4) * 255;
      pixels.data[offset + 1] = (0.5 - y * radiusSquared / 4) * 255;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  displacementTexture = canvas.toDataURL();
  return displacementTexture;
}

function attribute(element: Element, key: string, value: number | string) {
  const next = String(value);
  if (element.getAttribute(key) !== next) element.setAttribute(key, next);
}

function setRegion(element: Element, x: number, y: number, width: number, height: number) {
  attribute(element, "x", x);
  attribute(element, "y", y);
  attribute(element, "width", width);
  attribute(element, "height", height);
}

export function BlogScrollWarp({ posts }: { posts: BlogPost[] }) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = list.current;
    if (!root) return;
    const texture = getDisplacementTexture();
    if (!texture) return;
    const rows = [...root.children].flatMap((row) => {
      const media = row.querySelector<HTMLElement>(`.${styles.blogWarpMedia}`);
      const filter = row.querySelector("filter");
      const map = row.querySelector("feImage");
      const red = row.querySelector("feFuncR");
      const green = row.querySelector("feFuncG");
      const displacement = row.querySelector("feDisplacementMap");
      if (!media || !filter || !map || !red || !green || !displacement) return [];
      attribute(map, "href", texture);
      return [{ row, media, filter, map, red, green, displacement }];
    });
    const disabled = window.matchMedia("(prefers-reduced-motion: reduce), (hover: none) and (pointer: coarse)");
    let frame = 0;
    let lastTime = 0;
    let scrollSample = window.scrollY;
    let scrollTarget = scrollSample;
    let motionStart = 0;
    let motionFrom = scrollSample;
    let strength = 0;

    const draw = () => {
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      if (!width || !height) return;
      const axis = Math.max(width, height);
      const bounds = strength ? rows.map(({ media }) => media.getBoundingClientRect()) : [];
      rows.forEach(({ row, filter, map, red, green, displacement }, index) => {
        const rect = bounds[index];
        const visible = !!rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height;
        if (visible) {
          // Sample the viewport field, but keep the output padded in thumbnail coordinates.
          const padX = Math.ceil(width * BEND) + 2;
          const padY = Math.ceil(height * BEND) + 2;
          const outputWidth = Math.ceil(rect.width) + 2 * padX;
          const outputHeight = Math.ceil(rect.height) + 2 * padY;
          setRegion(filter, -padX, -padY, outputWidth, outputHeight);
          setRegion(displacement, -padX, -padY, outputWidth, outputHeight);
          setRegion(
            map,
            -rect.left - width * FIELD_GUARD,
            -rect.top - height * FIELD_GUARD,
            width * FIELD_SPAN,
            height * FIELD_SPAN,
          );
          attribute(red, "slope", width / axis);
          attribute(red, "intercept", (1 - width / axis) / 2);
          attribute(green, "slope", height / axis);
          attribute(green, "intercept", (1 - height / axis) / 2);
          attribute(displacement, "scale", (2 * BEND * axis * strength).toFixed(3));
        }
        row.toggleAttribute("data-warping", visible);
      });
    };

    const update = (now: number) => {
      frame = 0;
      const elapsed = lastTime ? Math.max(1, Math.min(50, now - lastTime)) : 1000 / 60;
      lastTime = now;
      const scroll = window.scrollY;
      let inMotion = false;
      if (disabled.matches) {
        scrollSample = scrollTarget = motionFrom = scroll;
        strength = 0;
      } else {
        // Ease only the velocity signal; the page keeps native scrolling.
        if (scroll !== scrollTarget) {
          motionFrom = scrollSample;
          motionStart = now - elapsed;
          scrollTarget = scroll;
        }
        const previousSample = scrollSample;
        const progress = Math.min(1, (now - motionStart) / MOTION_DURATION);
        const eased = Math.min(1, 1.001 - 2 ** (-10 * progress));
        scrollSample = motionFrom + (scrollTarget - motionFrom) * eased;
        inMotion = eased < 1 && motionFrom !== scrollTarget;
        const speed = Math.min(1, Math.abs(scrollSample - previousSample) * (1000 / 60) / (elapsed * 100));
        strength += (speed - strength) * (1 - Math.exp(-5 * elapsed / 1000));
        if (!inMotion && strength < 0.002) strength = 0;
      }
      draw();
      if (inMotion || strength) schedule();
      else lastTime = 0;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    disabled.addEventListener("change", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      disabled.removeEventListener("change", schedule);
      rows.forEach(({ row }) => row.removeAttribute("data-warping"));
    };
  }, [posts]);

  return (
    <div ref={list}>
      {posts.map((post, index) => {
        const id = `blog-viewport-warp-${index}`;
        return (
          <div key={post.id} className={styles.blogWarp} style={{ "--blog-warp-filter": `url(#${id})` } as CSSProperties}>
            <svg className="absolute size-0" aria-hidden="true" focusable="false">
              <filter id={id} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feImage preserveAspectRatio="none" result="viewportMap" />
                <feComponentTransfer in="viewportMap" result="pixelMap">
                  <feFuncR type="linear" />
                  <feFuncG type="linear" />
                </feComponentTransfer>
                <feFlood floodColor="rgb(50% 50% 50%)" result="neutral" />
                <feComposite in="pixelMap" in2="neutral" operator="over" result="filledMap" />
                <feDisplacementMap in="SourceGraphic" in2="filledMap" scale="0" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </svg>
            {/* The barrel warp is off: thumbnails now bend with scroll speed themselves (vvisual-style,
                see blog-book-stage). Pass `warpThumbnail` again to bring the old warp back. */}
            <EditorialBlogRow post={post} />
          </div>
        );
      })}
    </div>
  );
}
