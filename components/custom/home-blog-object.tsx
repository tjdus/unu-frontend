"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { HomeObjectCanvas } from "./home-object-canvas";

/**
 * Blog card visual: unpainted sheets of paper drifting down — they tilt, flutter and
 * curl as they fall, flatten and fade out at the bottom, then start over from the top.
 * Same studio tone as the Work object.
 */

const SHEET_W = 2.1;
const SHEET_D = 1.5; // sheet length
const SEG_X = 24;
const SEG_Y = 16;
const SHEETS = 4;
const FALL_S = 7.5; // one sheet's trip from the top to the stack

// Where each sheet's fall ends (it fades out there).
const LAND = { x: -0.55, y: -1.55 };
const START = { x: 1.15, y: 2.75 };
const PAPER = "#e9ebe8";

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Sheet = {
  geometry: THREE.PlaneGeometry;
  base: Float32Array;
  material: THREE.MeshPhysicalMaterial;
  seed: number;
};

function FallingSheets({ reducedMotion }: { reducedMotion: boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  const sheets = useMemo<Sheet[]>(
    () =>
      Array.from({ length: SHEETS }, (_, index) => {
        const geometry = new THREE.PlaneGeometry(SHEET_W, SHEET_D, SEG_X, SEG_Y);
        geometry.rotateX(-Math.PI / 2); // lie flat, like the stack
        return {
          geometry,
          base: Float32Array.from(geometry.attributes.position.array as Float32Array),
          material: new THREE.MeshPhysicalMaterial({
            color: PAPER,
            roughness: 0.8,
            side: THREE.DoubleSide,
            transparent: true,
            envMapIntensity: 0.35,
          }),
          seed: index * 1.7 + 0.4,
        };
      }),
    [],
  );

  useEffect(
    () => () => {
      sheets.forEach((sheet) => {
        sheet.geometry.dispose();
        sheet.material.dispose();
      });
    },
    [sheets],
  );

  useFrame(({ clock }) => {
    // Reduced motion: hold a composed still (sheets spread along their path).
    const t = reducedMotion ? 0 : clock.getElapsedTime();

    sheets.forEach((sheet, index) => {
      const mesh = meshes.current[index];
      if (!mesh) return;
      const { seed } = sheet;
      // Each sheet is a quarter trip apart, so there is always one near the top.
      const u = (t / FALL_S + index / SHEETS) % 1;
      // Falls a little faster as it goes.
      const fall = smoothstep(0, 1, u) * 0.35 + u * 0.65;
      const sway = Math.sin(u * Math.PI * 2.4 + seed) * (1 - u) * 0.75;

      mesh.position.set(
        THREE.MathUtils.lerp(START.x, LAND.x, fall) + sway,
        THREE.MathUtils.lerp(START.y, LAND.y, fall),
        Math.sin(u * Math.PI * 1.6 + seed) * 0.4 * (1 - u),
      );
      // Tumbles while high, flattens out as it lands.
      const loose = 1 - smoothstep(0.7, 0.98, u);
      mesh.rotation.set(
        Math.sin(u * Math.PI * 3 + seed) * 0.75 * loose,
        -0.35 + Math.sin(u * Math.PI * 1.4 + seed * 2) * 0.6 * loose,
        Math.cos(u * Math.PI * 2.6 + seed) * 0.55 * loose,
      );

      // Curl: a bend along the sheet's length plus a corner twist, both easing out on landing.
      const bend = Math.sin(u * Math.PI * 3.2 + seed) * 0.45 * loose;
      const twist = Math.cos(u * Math.PI * 2.2 + seed * 1.3) * 0.16 * loose;
      const position = sheet.geometry.attributes.position;
      const array = position.array as Float32Array;
      for (let i = 0; i < array.length; i += 3) {
        const x = sheet.base[i] / (SHEET_W / 2);
        const z = sheet.base[i + 2] / (SHEET_D / 2);
        array[i + 1] = bend * (x * x - 0.33) + twist * x * z;
      }
      position.needsUpdate = true;
      sheet.geometry.computeVertexNormals();

      // Appear at the top, fade out at the end of the fall.
      sheet.material.opacity = smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));
    });
  });

  return (
    <>
      {sheets.map((sheet, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            meshes.current[index] = mesh;
          }}
          geometry={sheet.geometry}
          material={sheet.material}
        />
      ))}
    </>
  );
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    // A three-quarter view from slightly above, like the reference photo.
    <group rotation={[0.32, -0.55, 0]} position={[-0.1, 0.1, 0]} scale={1.12}>
      <FallingSheets reducedMotion={reducedMotion} />
    </group>
  );
}

export function HomeBlogObject() {
  return (
    <HomeObjectCanvas>
      {(reducedMotion) => <Scene reducedMotion={reducedMotion} />}
    </HomeObjectCanvas>
  );
}
