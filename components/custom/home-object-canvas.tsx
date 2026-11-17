"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Soft studio light from RoomEnvironment, so white reads as white without colour casts. */
function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const map = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return map;
  }, [gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive object={texture} attach="environment" />;
}

/**
 * Shared stage for the home Work / Blog objects: same camera, studio light and tone, and
 * it only renders while on screen. Children get whether reduced motion is on.
 */
export function HomeObjectCanvas({
  children,
}: {
  children: (reducedMotion: boolean) => ReactNode;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    syncMotion();
    media.addEventListener("change", syncMotion);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "120px 0px",
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <span ref={host} aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
      <Canvas
        frameloop={visible ? (reducedMotion ? "demand" : "always") : "never"}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 11], fov: 30 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        <StudioEnvironment />
        <hemisphereLight args={["#ffffff", "#7d867f", 0.35]} />
        <directionalLight position={[-4, 10, 7]} intensity={1.7} />
        <directionalLight position={[8, 2, 3]} intensity={0.25} />
        {children(reducedMotion)}
      </Canvas>
    </span>
  );
}
