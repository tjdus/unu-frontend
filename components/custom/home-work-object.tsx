"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { HomeObjectCanvas } from "./home-object-canvas";

/**
 * Work card visual: an unpainted, loosely assembled 3×3 block cluster — matte white
 * blocks and a few frosted clear ones — floating on the section. Its rows turn a
 * quarter at a time like a puzzle cube, blocks breathe slightly apart, and the cluster
 * bobs and sways. Renders only while on screen.
 */

type Block = {
  /** grid position of the block's min corner (x right, y up, z toward viewer) */
  at: [number, number, number];
  /** size in cells */
  size?: [number, number, number];
  glass?: boolean;
  /** extra push out of the cluster, in cells */
  push?: [number, number, number];
};

const BLOCKS: Block[] = [
  // bottom layer
  { at: [0, 0, 2] },
  { at: [1, 0, 2] },
  { at: [2, 0, 2] },
  { at: [0, 0, 1] },
  { at: [2, 0, 0], size: [1, 1, 2] },
  { at: [0, 0, 0], size: [2, 1, 1] },
  { at: [1, 0, 1], glass: true },
  // middle layer
  { at: [0, 1, 2] },
  { at: [1, 1, 2], push: [0, 0, 0.28] },
  { at: [2, 1, 2], glass: true },
  { at: [2, 1, 0], size: [1, 1, 2] },
  { at: [0, 1, 0] },
  { at: [1, 1, 1], glass: true },
  // top layer
  { at: [0, 2, 2], push: [-0.12, 0.1, 0] },
  { at: [0, 2, 0], size: [3, 1, 1] },
  { at: [1, 2, 1], glass: true, push: [0, 0.18, 0] },
  { at: [2, 2, 1], size: [1, 1, 2], glass: true },
];

const GAP = 0.06; // seam between blocks (cells)
const RADIUS = 0.06;

// Row turns: one horizontal layer at a time turns a quarter around the vertical axis,
// like a puzzle cube being worked, then rests before the next.
const TURN_S = 0.95;
const REST_S = 0.75;
const CYCLE_S = TURN_S + REST_S;
const LAYER_ORDER = [2, 0, 1, 2, 1, 0];
const LAYER_DIRS = [1, -1, 1, -1, -1, 1];
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function useMaterials() {
  return useMemo(() => {
    const solid = new THREE.MeshPhysicalMaterial({
      color: "#e2e5e1",
      roughness: 0.5,
      metalness: 0.05,
      clearcoat: 0.3,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.3,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.32,
      envMapIntensity: 1.4,
      clearcoat: 1,
      clearcoatRoughness: 0.25,
      depthWrite: false,
    });
    return { solid, glass };
  }, []);
}

function Cluster({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const layers = useRef<(THREE.Group | null)[]>([]);
  const parts = useRef<(THREE.Mesh | null)[]>([]);
  const turn = useRef({ step: -1, layer: 0, dir: 1, base: [0, 0, 0] });
  const { solid, glass } = useMaterials();

  const blocks = useMemo(
    () =>
      BLOCKS.map((block, index) => {
        const [sx, sy, sz] = block.size ?? [1, 1, 1];
        const geometry = new RoundedBoxGeometry(sx - GAP, sy - GAP, sz - GAP, 3, RADIUS);
        const center = new THREE.Vector3(
          block.at[0] + sx / 2 - 1.5,
          block.at[1] + sy / 2 - 1.5,
          block.at[2] + sz / 2 - 1.5,
        );
        if (block.push) center.add(new THREE.Vector3(...block.push));
        // Direction each block drifts while "breathing": away from the cluster centre.
        const drift = center.clone().normalize().multiplyScalar(0.07);
        return {
          geometry,
          center,
          drift,
          glass: Boolean(block.glass),
          phase: index * 0.7,
          layer: block.at[1],
        };
      }),
    [],
  );

  useEffect(
    () => () => {
      blocks.forEach((block) => block.geometry.dispose());
      solid.dispose();
      glass.dispose();
    },
    [blocks, solid, glass],
  );

  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.getElapsedTime();
    if (group.current) {
      group.current.position.y = Math.sin(t * 0.9) * 0.12;
      group.current.rotation.y = -Math.PI / 4 + Math.sin(t * 0.35) * 0.12;
      group.current.rotation.x = 0.4 + Math.sin(t * 0.5) * 0.04;
    }
    // Advance the row-turn sequence; a finished quarter turn is folded into its base angle.
    const state = turn.current;
    const step = Math.floor(t / CYCLE_S);
    if (step !== state.step) {
      if (state.step >= 0) state.base[state.layer] += (state.dir * Math.PI) / 2;
      state.step = step;
      state.layer = LAYER_ORDER[step % LAYER_ORDER.length];
      state.dir = LAYER_DIRS[step % LAYER_DIRS.length];
    }
    const progress = reducedMotion ? 0 : easeInOutCubic(Math.min(1, (t % CYCLE_S) / TURN_S));
    layers.current.forEach((layer, index) => {
      if (!layer) return;
      layer.rotation.y =
        state.base[index] + (index === state.layer ? (state.dir * Math.PI * progress) / 2 : 0);
    });

    blocks.forEach((block, index) => {
      const mesh = parts.current[index];
      if (!mesh) return;
      const breathe = (Math.sin(t * 0.8 + block.phase) + 1) / 2;
      mesh.position.copy(block.center).addScaledVector(block.drift, breathe);
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2].map((layerIndex) => (
        <group
          key={layerIndex}
          ref={(layer) => {
            layers.current[layerIndex] = layer;
          }}
        >
          {blocks.map((block, index) =>
            block.layer === layerIndex ? (
              <mesh
                key={index}
                ref={(mesh) => {
                  parts.current[index] = mesh;
                }}
                geometry={block.geometry}
                material={block.glass ? glass : solid}
                position={block.center}
                renderOrder={block.glass ? 1 : 0}
              />
            ) : null,
          )}
        </group>
      ))}
    </group>
  );
}

export function HomeWorkObject() {
  return (
    <HomeObjectCanvas>
      {(reducedMotion) => <Cluster reducedMotion={reducedMotion} />}
    </HomeObjectCanvas>
  );
}
