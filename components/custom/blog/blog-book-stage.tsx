"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import styles from "./blog-book-thumbnail.module.css";
import { holdPageLoad } from "../page-load-hold";

/**
 * Blog thumbnail: a floating open booklet whose pages keep turning, right to left.
 *
 * Pages are curved sheets hinged on a shared spine. Two rest open (left and right); a few
 * more turn over in a staggered loop, curling while they move. A page that finishes its
 * turn lies exactly on the left page and restarts hidden under the right one, so the loop
 * never jumps.
 *
 * All rows share ONE offscreen renderer (WebGL contexts are capped per page): each visible
 * row owns a 2D canvas and one loop renders the booklet for it with that row's timing.
 */

const PAGE_W = 1.35; // spine → outer edge
const PAGE_H = 1.9; // along the spine
const SEG_U = 28;
const SEG_V = 4;
const REST_LEFT = Math.PI - 0.42; // resting angles (0 = flat to the right)
const REST_RIGHT = 0.42;
const REST_CURL = -0.32; // resting pages lift at the edges a little
const STACK = 6; // resting sheets per side (the book's thickness)
const STACK_FAN = 0.035; // each sheet below lies this much flatter (rad), so edges show depth
const TURNING = 4; // pages in flight
const TURN_S = 2.4; // one page's turn
const CYCLE_S = 4.2; // a page's turn + its rest on the left
const PAPER = ["#f3eee6", "#efe9e0", "#f6f2ec", "#ece5da", "#f1ebe3"];

/** Positions for a sheet hinged at the spine: an arc of curvature `curl`, rising at `angle`. */
function shapePage(geometry: THREE.BufferGeometry, angle: number, curl: number, lift: number) {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const array = position.array as Float32Array;
  const k = Math.abs(curl) < 1e-4 ? 1e-4 : curl;
  for (let v = 0; v <= SEG_V; v++) {
    const z = (v / SEG_V - 0.5) * PAGE_H;
    for (let u = 0; u <= SEG_U; u++) {
      const s = (u / SEG_U) * PAGE_W;
      // Arc of constant curvature starting at the spine in direction `angle`.
      const x = (Math.sin(angle + k * s) - Math.sin(angle)) / k;
      const y = (Math.cos(angle) - Math.cos(angle + k * s)) / k;
      const index = (v * (SEG_U + 1) + u) * 3;
      // Stack pages a hair apart along their normal so resting ones never fight.
      array[index] = -x * 1; // flip so angle 0 opens to the right
      array[index + 1] = y + lift;
      array[index + 2] = z;
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function makePage() {
  const geometry = new THREE.BufferGeometry();
  const count = (SEG_U + 1) * (SEG_V + 1);
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const indices: number[] = [];
  for (let v = 0; v < SEG_V; v++) {
    for (let u = 0; u < SEG_U; u++) {
      const a = v * (SEG_U + 1) + u;
      const b = a + SEG_U + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  geometry.setIndex(indices);
  return geometry;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

type Row = {
  canvas: HTMLCanvasElement;
  phase: number;
  visible: boolean;
  drawn?: boolean;
  releaseLoad?: () => void;
};
type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  book: THREE.Group;
  rest: { left: THREE.Mesh; right: THREE.Mesh };
  turning: THREE.Mesh[];
};

let stage: Stage | null = null;
const rows = new Set<Row>();
let frame = 0;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function createStage(): Stage {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(-2, 6, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff6ea, 0.3);
  fill.position.set(4, 1, 3);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(30, 3 / 2, 0.1, 50);
  camera.position.set(0, 1.6, 6.4);
  camera.lookAt(0, 0.35, 0);

  const material = (color: string) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.78,
      side: THREE.DoubleSide,
      envMapIntensity: 0.35,
    });
  const book = new THREE.Group();
  // Resting stacks: the top sheet sits at the resting angle, each one below a little
  // flatter and lower, which reads as a few millimetres of paper on each side.
  const restStack = (side: "left" | "right") =>
    Array.from({ length: STACK }, (_, depth) => {
      const page = new THREE.Mesh(makePage(), material(PAPER[(depth + (side === "left" ? 0 : 2)) % PAPER.length]));
      const angle = side === "left" ? REST_LEFT + depth * STACK_FAN : REST_RIGHT - depth * STACK_FAN;
      const curl = (side === "left" ? -REST_CURL : REST_CURL) * (1 - depth * 0.08);
      shapePage(page.geometry, angle, curl, -0.006 * depth);
      book.add(page);
      return page;
    });
  const left = restStack("left")[0];
  const right = restStack("right")[0];
  const turning = Array.from({ length: TURNING }, (_, index) => {
    const page = new THREE.Mesh(makePage(), material(PAPER[2 + (index % 3)]));
    book.add(page);
    return page;
  });
  scene.add(book);
  return { renderer, scene, camera, book, rest: { left, right }, turning };
}

function pose(s: Stage, time: number) {
  // The booklet floats: a slow sway and bob, tipped toward the viewer like the reference.
  s.book.rotation.set(0.18 + Math.sin(time * 0.5) * 0.05, -0.38 + Math.sin(time * 0.32) * 0.12, -0.12);
  s.book.position.y = 0.2 + Math.sin(time * 0.85) * 0.06;

  s.turning.forEach((page, index) => {
    const local = (((time / CYCLE_S + index / TURNING) % 1) + 1) % 1;
    const p = Math.min(1, (local * CYCLE_S) / TURN_S);
    const turn = easeInOut(p);
    const angle = REST_RIGHT + (REST_LEFT - REST_RIGHT) * turn;
    // Curl swings from the resting lift on the right, through a lagging bend while it
    // turns, to the mirrored lift on the left.
    const travel = Math.sin(p * Math.PI);
    const curl = REST_CURL * (1 - 2 * turn) - 0.95 * travel;
    // Pages in flight sit a hair above the rest so they never z-fight with them.
    shapePage(page.geometry as THREE.BufferGeometry, angle, curl, 0.004 * (index + 1));
  });
}

function renderRow(s: Stage, row: Row, t: number) {
  const { canvas } = row;
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

  pose(s, t + row.phase);
  s.renderer.render(s.scene, s.camera);

  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, pw, ph);
  // Soft shadow under the floating booklet.
  const cx = pw / 2;
  const cy = ph * 0.88;
  context.save();
  context.translate(cx, cy);
  context.scale(1, 0.16);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, pw * 0.24);
  gradient.addColorStop(0, "rgba(0,0,0,0.3)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, pw * 0.24, 0, Math.PI * 2);
  context.fill();
  context.restore();
  drawBent(context, s.renderer.domElement, pw, ph);
}

// ── Scroll bend (after vvisual.biz) ───────────────────────────────────────────
// While the page scrolls, each thumbnail bows along the scroll direction: its middle is
// pushed further than its edges (cos(x·π) · speed), and it narrows a little; it eases flat
// when scrolling stops. Drawn as thin vertical strips, so edges stay clean.
const BEND_STRIPS = 56;
const BEND_DEPTH = 0.1; // middle offset at full speed, as a fraction of the height
const BEND_SQUEEZE = 0.1; // width lost at full speed
const FULL_SPEED = 45; // px per 60 Hz frame that counts as full speed
const BEND_EASE = 7; // how quickly the bend follows the speed (1/s)

let bend = 0; // -1…1, + while scrolling down
let lastScrollY = typeof window === "undefined" ? 0 : window.scrollY;
let lastBendTime = 0;

function updateBend(now: number, still: boolean) {
  const dt = lastBendTime ? Math.max(1, Math.min(50, now - lastBendTime)) : 1000 / 60;
  lastBendTime = now;
  const moved = window.scrollY - lastScrollY;
  lastScrollY = window.scrollY;
  const target = still ? 0 : Math.max(-1, Math.min(1, (moved * (1000 / 60)) / dt / FULL_SPEED));
  bend += (target - bend) * (1 - Math.exp((-BEND_EASE * dt) / 1000));
  if (Math.abs(bend) < 0.002 && !moved) bend = 0;
}

function drawBent(context: CanvasRenderingContext2D, source: HTMLCanvasElement, pw: number, ph: number) {
  if (!bend) {
    context.drawImage(source, 0, 0, pw, ph);
    return;
  }
  const squeeze = 1 - Math.abs(bend) * BEND_SQUEEZE;
  const strip = pw / BEND_STRIPS;
  const center = pw / 2;
  for (let index = 0; index < BEND_STRIPS; index++) {
    const sx = index * strip;
    const across = (index + 0.5) / BEND_STRIPS - 0.5; // -0.5 … 0.5
    // Scrolling down, the middle trails behind (drawn lower); up, it trails above.
    const dy = Math.cos(across * Math.PI) * bend * BEND_DEPTH * ph;
    const dx = center + (sx - center) * squeeze;
    // +1 px overlap so neighbouring strips never show a seam.
    context.drawImage(source, sx, 0, strip, ph, dx, dy, strip * squeeze + 1, ph);
  }
}

function loop(now: number) {
  frame = 0;
  if (!stage) return;
  const still = reducedMotion();
  const t = still ? 1.1 : now / 1000; // a mid-turn still when motion is reduced
  updateBend(now, still);
  let any = false;
  for (const row of rows) {
    if (!row.visible) continue;
    any = true;
    renderRow(stage, row, t);
    // First frame on screen: let the page loading screen go.
    if (row.releaseLoad && row.canvas.clientWidth) {
      row.releaseLoad();
      row.releaseLoad = undefined;
      row.drawn = true;
    }
  }
  if (any && !still) frame = requestAnimationFrame(loop);
}

function kick() {
  if (!frame) frame = requestAnimationFrame(loop);
}

function register(row: Row) {
  stage ??= createStage();
  rows.add(row);
  kick();
}

function unregister(row: Row) {
  rows.delete(row);
  if (rows.size || !stage) return;
  cancelAnimationFrame(frame);
  frame = 0;
  stage.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  stage.scene.environment?.dispose();
  stage.renderer.dispose();
  stage = null;
}

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return value >>> 0;
}

export function BlogBookStage({ seed }: { seed: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // Each post turns its pages on its own beat.
    const row: Row = { canvas, phase: (hash(seed) % 1000) / 1000 * CYCLE_S * 3, visible: false };
    register(row);
    const observer = new IntersectionObserver(([entry]) => {
      row.visible = entry.isIntersecting;
      // Seen before its first frame: hold the page loading screen until it is drawn.
      if (row.visible && !row.drawn) row.releaseLoad ??= holdPageLoad();
      if (row.visible) kick();
    }, { rootMargin: "100px" });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      row.releaseLoad?.();
      unregister(row);
    };
  }, [seed]);

  return <canvas ref={ref} className={styles.canvas} aria-hidden="true" />;
}
