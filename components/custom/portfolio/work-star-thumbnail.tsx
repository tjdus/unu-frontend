"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import styles from "./work-star-thumbnail.module.css";
import { holdPageLoad } from "../page-load-hold";

/**
 * Work thumbnail: a four-pointed star with creased, concave faces and a thin orbit ring
 * with a bead, slowly turning on a transparent ground. Colour comes from the shared palette
 * (one per project, by list position).
 *
 * All cards share ONE offscreen WebGL renderer (browsers cap live WebGL contexts at ~16):
 * each visible card owns a 2D canvas, and one loop renders the scene per card with that
 * card's colour and timing, then copies the frame into it.
 */

// Same palette as the generated title thumbnails (WorkTitleThumbnail's GROUNDS, glow tone).
export const STAR_COLORS = ["#2b8a5e", "#3a9a93", "#8aa35a", "#6f8fa8", "#c7865a", "#6f8078"];

// ── Geometry ──────────────────────────────────────────────────────────────────
const RX = 1.12; // horizontal tip reach
const RY = 1.38; // vertical tip reach
const DEPTH = 0.42; // apex height above the star's plane
const SEG_S = 18; // apex → edge
const SEG_T = 40; // along each concave edge

/** One side of the star: four concave quadrants fanned from an apex, creased at the tips. */
function starSide(sign: 1 | -1) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const base = positions.length / 3;
    for (let i = 0; i <= SEG_S; i++) {
      const s = i / SEG_S; // 0 at the apex, 1 on the outline
      for (let j = 0; j <= SEG_T; j++) {
        const t = (quadrant + j / SEG_T) * (Math.PI / 2);
        // Astroid outline: sharp tips, edges curving in toward the centre.
        const ox = RX * Math.cos(t) ** 3;
        const oy = RY * Math.sin(t) ** 3;
        // Faces dish inward: depth falls off faster than linearly toward the edge.
        const z = sign * DEPTH * (1 - s) ** 1.6;
        positions.push(ox * s, oy * s, z);
      }
    }
    const row = SEG_T + 1;
    for (let i = 0; i < SEG_S; i++) {
      for (let j = 0; j < SEG_T; j++) {
        const a = base + i * row + j;
        const b = a + row;
        if (sign > 0) indices.push(a, b, a + 1, a + 1, b, b + 1);
        else indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); // per quadrant → creases where quadrants meet at the tips
  return geometry;
}

const WHITE = new THREE.Color("#ffffff");

// ── Shared stage ──────────────────────────────────────────────────────────────
type Card = {
  canvas: HTMLCanvasElement;
  color: THREE.Color;
  phase: number;
  visible: boolean;
  drawn?: boolean;
  releaseLoad?: () => void;
};

type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  star: THREE.Group;
  starMaterial: THREE.MeshPhysicalMaterial;
  ring: THREE.Group;
  bead: THREE.Mesh;
  ringMaterial: THREE.MeshPhysicalMaterial;
};

let stage: Stage | null = null;
const cards = new Set<Card>();
let frame = 0;
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function createStage(): Stage {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5f6b63, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(5, -1, 3);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 50);
  camera.position.set(0, 0, 6.9);

  const starMaterial = new THREE.MeshPhysicalMaterial({
    roughness: 0.6,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
    side: THREE.DoubleSide,
    envMapIntensity: 0.25,
  });
  const star = new THREE.Group();
  star.add(new THREE.Mesh(starSide(1), starMaterial), new THREE.Mesh(starSide(-1), starMaterial));
  scene.add(star);

  const ringMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.4, envMapIntensity: 0.35 });
  const ring = new THREE.Group();
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.012, 12, 160), ringMaterial));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), ringMaterial);
  ring.add(bead);
  ring.rotation.set(1.18, -0.42, 0.18); // a tilted orbit, like the reference
  scene.add(ring);

  return { renderer, scene, camera, star, starMaterial, ring, bead, ringMaterial };
}

function renderCard(s: Stage, card: Card, t: number) {
  const { canvas } = card;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const size = s.renderer.getSize(new THREE.Vector2());
  if (size.x !== width || size.y !== height || s.renderer.getPixelRatio() !== dpr) {
    s.renderer.setPixelRatio(dpr);
    s.renderer.setSize(width, height, false);
  }
  s.camera.aspect = width / height;
  s.camera.updateProjectionMatrix();

  // Colour: the palette tone itself on the star; the ring a lighter tint of it.
  s.starMaterial.color.copy(card.color);
  s.ringMaterial.color.copy(card.color).lerp(WHITE, 0.55);

  // Natural turn: a slow spin with a gentle wobble and bob; the bead orbits.
  const time = t + card.phase;
  s.star.rotation.set(
    0.18 + Math.sin(time * 0.45) * 0.16,
    time * 0.35,
    -0.32 + Math.sin(time * 0.3) * 0.08,
  );
  s.star.position.y = 0.18 + Math.sin(time * 0.8) * 0.06;
  s.ring.position.y = s.star.position.y;
  const orbit = time * 0.6;
  s.bead.position.set(Math.cos(orbit) * 1.75, Math.sin(orbit) * 1.75, 0);

  s.renderer.render(s.scene, s.camera);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, pw, ph);
  // Soft contact shadow under the floating star.
  const shadowY = ph * 0.9;
  const gradient = context.createRadialGradient(pw / 2, shadowY / 0.18, 0, pw / 2, shadowY / 0.18, pw * 0.2);
  gradient.addColorStop(0, "rgba(0,0,0,0.32)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.save();
  context.scale(1, 0.18);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(pw / 2, shadowY / 0.18, pw * 0.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.drawImage(s.renderer.domElement, 0, 0, pw, ph);
}

function loop(now: number) {
  frame = 0;
  if (!stage) return;
  const t = reducedMotion() ? 0 : now / 1000;
  let any = false;
  for (const card of cards) {
    if (!card.visible) continue;
    any = true;
    renderCard(stage, card, t);
    // First frame on screen: let the page loading screen go.
    if (card.releaseLoad && card.canvas.clientWidth) {
      card.releaseLoad();
      card.releaseLoad = undefined;
      card.drawn = true;
    }
  }
  if (any && !reducedMotion()) frame = requestAnimationFrame(loop);
}

function kick() {
  if (!frame) frame = requestAnimationFrame(loop);
}

function register(card: Card) {
  stage ??= createStage();
  cards.add(card);
  kick();
}

function unregister(card: Card) {
  cards.delete(card);
  if (cards.size || !stage) return;
  cancelAnimationFrame(frame);
  frame = 0;
  stage.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  stage.starMaterial.dispose();
  stage.ringMaterial.dispose();
  stage.scene.environment?.dispose();
  stage.renderer.dispose();
  stage = null;
}

export function WorkStarThumbnail({ index = 0 }: { index?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const card: Card = {
      canvas,
      color: new THREE.Color(STAR_COLORS[index % STAR_COLORS.length]),
      phase: index * 2.3,
      visible: false,
    };
    register(card);
    const observer = new IntersectionObserver(([entry]) => {
      card.visible = entry.isIntersecting;
      // Seen before its first frame: hold the page loading screen until it is drawn.
      if (card.visible && !card.drawn) card.releaseLoad ??= holdPageLoad();
      if (card.visible) kick();
    }, { rootMargin: "100px" });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      card.releaseLoad?.();
      unregister(card);
    };
  }, [index]);

  return <canvas ref={ref} className={styles.canvas} aria-hidden="true" />;
}
