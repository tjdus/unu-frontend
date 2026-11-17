"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { HOME_ENTRANCE_COMPLETE } from "./home-entrance";

type PointerState = {
  active: boolean;
  x: number;
  y: number;
  revision: number;
};

type LandingState = {
  id: number;
  x: number;
  z: number;
  scale: number;
  visible: boolean;
};

type CubeAnchor = { x: number; y: number; titleTopY: number };

const FACE_LETTERS = ["U", "U", "N", "N", "C", "C"];
// Rendered at 75% of the original 1.24 world units (physics, landing and web scale with it).
const CUBE_SIZE_SCALE = 0.75;
const CUBE_SIZE = 1.24 * CUBE_SIZE_SCALE;

const ANCHOR_FONT_SCALE_STOPS: [fontSizePx: number, scale: number][] = [
  [12.6, 0.5],
  [21.6, 0.58],
];
const DEFAULT_CUBE_SCALE = ANCHOR_FONT_SCALE_STOPS[0][1];

function getFontSizeCubeScale(fontSizePx: number | null): number {
  if (fontSizePx === null) return DEFAULT_CUBE_SCALE;

  const stops = ANCHOR_FONT_SCALE_STOPS;
  if (fontSizePx <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [prevSize, prevScale] = stops[i - 1];
    const [size, scale] = stops[i];
    if (fontSizePx <= size) {
      const t = (fontSizePx - prevSize) / (size - prevSize);
      return prevScale + t * (scale - prevScale);
    }
  }
  return stops[stops.length - 1][1];
}
const CUBE_START_POSITION: [number, number, number] = [-2.35, 0.41, -0.1];
const CUBE_START_ROTATION: [number, number, number] = [0.34, -0.55, 0];
const CUBE_INTRO_START_X = 5.2;
const CUBE_INTRO_START_Y = 3.45;
const CUBE_INTRO_DURATION = 2.4;
const CUBE_INTRO_FIRST_CONTACT = 0.28;
const CUBE_INTRO_SECOND_CONTACT = 0.72;
const CUBE_INTRO_FINAL_CONTACT = 0.94;
const CUBE_INTRO_CONTACT_X = [2.15, -1, CUBE_START_POSITION[0]];
const CUBE_INTRO_CONTACT_ANGLE = [(Math.PI * 3) / 4, Math.PI / 4, 0];
const CUBE_INTRO_HOP_HEIGHT = [0.82, 0.34];
const HOVER_TRIGGER_RADIUS = 0.25;
const HOVER_RESET_RADIUS = 0.36;
const MIN_REACTION_INTERVAL = 0.65;
const FLOOR_SURFACE_Y = -0.46;
// The cube rolls this many CSS px above the ruler's top edge. Applied through the camera
// framing, so the floor, the cube and the landing web (all at FLOOR_SURFACE_Y) move together.
const FLOOR_RAISE_PX = 18;
const AIRBORNE_CLEARANCE = 0.06;

const INTRO_IDLE_POSITION: [number, number, number] = [
  CUBE_INTRO_START_X,
  CUBE_INTRO_START_Y,
  CUBE_START_POSITION[2],
];
// Longest frame step fed to the intro / idle animations (avoids jumps after a pause).
const MAX_FRAME_DELTA = 1 / 30;
// After a teleport (out-of-bounds reset) keep the cube hidden until the rapier
// interpolation has stepped past the old pose, so no in-between ghost frame is drawn.
const TELEPORT_HIDE_SECONDS = 0.06;

type IntroContact = { angle: number; x: number; centerY: number; webX: number; webZ: number };
type IntroPlan = { startX: number; contacts: IntroContact[] };

/** Roll-in path, shifted as a whole so it ends on the landing spot (hop lengths unchanged). */
function buildIntroPlan(bounds: ArenaBounds, finalQuaternion: THREE.Quaternion): IntroPlan {
  const target = THREE.MathUtils.clamp(
    bounds.landing ?? CUBE_INTRO_CONTACT_X[2],
    bounds.left + CUBE_SIZE * 0.6,
    bounds.right - CUBE_SIZE * 0.6,
  );
  const offsetX = target - CUBE_INTRO_CONTACT_X[2];
  const rollAxis = new THREE.Vector3(0, 0, 1);
  const contacts = CUBE_INTRO_CONTACT_ANGLE.map((angle, index) => {
    const roll = new THREE.Quaternion().setFromAxisAngle(rollAxis, angle);
    const orientation = new THREE.Quaternion().copy(finalQuaternion).premultiply(roll);
    const groundContact = getCubeGroundContact(orientation);
    const x = CUBE_INTRO_CONTACT_X[index] + offsetX;
    return {
      angle,
      x,
      centerY: groundContact.centerY,
      webX: x + groundContact.offsetX,
      webZ: CUBE_START_POSITION[2] + groundContact.offsetZ,
    };
  });
  return { startX: CUBE_INTRO_START_X + offsetX, contacts };
}

function getCubeGroundContact(quaternion: THREE.Quaternion) {
  const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
  const rotatedCorner = new THREE.Vector3();
  const contactOffset = new THREE.Vector3();
  const halfSize = CUBE_SIZE / 2;
  let lowestY = Number.POSITIVE_INFINITY;
  let contactCount = 0;

  for (const x of [-halfSize, halfSize]) {
    for (const y of [-halfSize, halfSize]) {
      for (const z of [-halfSize, halfSize]) {
        rotatedCorner.set(x, y, z).applyMatrix4(rotationMatrix);

        if (rotatedCorner.y < lowestY - 0.025) {
          lowestY = rotatedCorner.y;
          contactOffset.copy(rotatedCorner);
          contactCount = 1;
        } else if (Math.abs(rotatedCorner.y - lowestY) <= 0.025) {
          contactOffset.add(rotatedCorner);
          contactCount += 1;
        }
      }
    }
  }

  contactOffset.divideScalar(contactCount);
  return {
    centerY: FLOOR_SURFACE_Y - lowestY,
    offsetX: contactOffset.x,
    offsetZ: contactOffset.z,
  };
}

function createLandingWebGeometry() {
  const lineVertices: number[] = [];
  const spokeCount = 12;
  const ringCount = 5;
  const spokeAngles = Array.from({ length: spokeCount }, (_, spoke) =>
    (spoke / spokeCount) * Math.PI * 2 + Math.sin(spoke * 2.17) * 0.035,
  );

  const pointAt = (angle: number, radius: number) => [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
    0,
  ] as const;

  for (let spoke = 0; spoke < spokeCount; spoke += 1) {
    const angle = spokeAngles[spoke];
    const radius = 0.96 + Math.sin(spoke * 1.9) * 0.08;
    lineVertices.push(...pointAt(angle, 0.07), ...pointAt(angle, radius));
  }

  for (let ring = 1; ring <= ringCount; ring += 1) {
    const ringRadius = 0.08 + (ring / ringCount) * 0.9;

    for (let spoke = 0; spoke < spokeCount; spoke += 1) {
      const angle = spokeAngles[spoke];
      const nextAngle =
        spoke === spokeCount - 1 ? spokeAngles[0] + Math.PI * 2 : spokeAngles[spoke + 1];
      const radius = ringRadius * (1 + Math.sin(spoke * 1.7 + ring) * 0.045);
      const nextRadius =
        ringRadius * (1 + Math.sin((spoke + 1) * 1.7 + ring) * 0.045);
      let previousPoint = pointAt(angle, radius);
      for (let segment = 1; segment <= 4; segment += 1) {
        const progress = segment / 4;
        const segmentAngle = THREE.MathUtils.lerp(angle, nextAngle, progress);
        const curvedRadius =
          THREE.MathUtils.lerp(radius, nextRadius, progress) -
          Math.sin(progress * Math.PI) * (0.018 + ring * 0.006);
        const nextPoint = pointAt(segmentAngle, curvedRadius);
        lineVertices.push(...previousPoint, ...nextPoint);
        previousPoint = nextPoint;
      }
    }
  }

  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.Float32BufferAttribute(lineVertices, 3));
  return lines;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function createFaceTexture(letter: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  context.fillStyle = "#68c29d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 10;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  context.fillStyle = "#ffffff";
  context.font = "800 310px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(letter, canvas.width / 2, canvas.height / 2 + 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/** Horizontal limits of the play area in world units (left/right inner wall faces). */
type ArenaBounds = {
  left: number;
  right: number;
  /** World X where the intro ends and the cube rests (defaults to CUBE_START_POSITION). */
  landing?: number;
};

const DEFAULT_ARENA_BOUNDS: ArenaBounds = { left: -4.53, right: 4.53 };
const CAMERA_Z = 8.4;
const CAMERA_FOV = 40;
const ARENA_HALF_DEPTH = 1.75;
const ARENA_ESCAPE_MARGIN = 1.25;
const ARENA_REFERENCE_DISTANCE = CAMERA_Z - CUBE_START_POSITION[2];
const VISIBLE_HALF_HEIGHT = ARENA_REFERENCE_DISTANCE * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));

// Follow the camera ray so the left wall projects to the same edge at every depth.
function leftWallX(left: number, depth: number) {
  return left * (CAMERA_Z - depth) / ARENA_REFERENCE_DISTANCE;
}

/**
 * Drops the time that piled up while the canvas or the tab was not rendering, so physics
 * does not fast-forward (up to 0.5 s of catch-up steps) and make the cube jump on return.
 */
function ClockGuard({ running }: { running: boolean }) {
  const getState = useThree((state) => state.get);

  useEffect(() => {
    if (running) getState().clock.getDelta();
  }, [getState, running]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") getState().clock.getDelta();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [getState]);

  return null;
}

function CameraRig({ offsetY }: { offsetY: number }) {
  const getState = useThree((state) => state.get);

  useEffect(() => {
    getState().invalidate();
  }, [getState, offsetY]);

  // Pure vertical translation: the physics world stays where it is, only the framing moves.
  // Re-applied per frame because the Canvas may re-apply its `camera` props on re-render.
  useFrame(({ camera }) => {
    if (camera.position.y === offsetY) return;
    camera.position.y = offsetY;
    camera.updateMatrixWorld();
  }, -1);

  return null;
}

function Arena({ bounds }: { bounds: ArenaBounds }) {
  const WALL = 0.12;
  const left = leftWallX(bounds.left, 0);
  const leftAngle = Math.atan(-bounds.left / ARENA_REFERENCE_DISTANCE);
  const leftCos = Math.cos(leftAngle);
  const outerLeft = Math.min(leftWallX(bounds.left, -ARENA_HALF_DEPTH), leftWallX(bounds.left, ARENA_HALF_DEPTH));
  const halfWidth = (bounds.right - outerLeft) / 2 + WALL * 2;
  const centerX = (outerLeft + bounds.right) / 2;
  const floorY = -0.58;
  const ceilingY = 2.78;
  const wallCenterY = (floorY + ceilingY) / 2;
  const wallHalfHeight = (ceilingY - floorY) / 2;

  return (
    <>
      <RigidBody name="arena-floor" type="fixed" colliders={false}>
        <CuboidCollider
          args={[halfWidth, WALL, ARENA_HALF_DEPTH]}
          position={[centerX, floorY, 0]}
          friction={0.82}
          restitution={0.4}
        />
      </RigidBody>
      <RigidBody name="arena-bounds" type="fixed" colliders={false}>
        <CuboidCollider
          args={[halfWidth, WALL, ARENA_HALF_DEPTH]}
          position={[centerX, ceilingY, 0]}
          friction={0.6}
          restitution={0.46}
        />
        <CuboidCollider
          args={[WALL, wallHalfHeight, ARENA_HALF_DEPTH / leftCos]}
          position={[left - WALL * leftCos, wallCenterY, WALL * Math.sin(leftAngle)]}
          rotation={[0, leftAngle, 0]}
          contactSkin={0.08}
          friction={0.7}
          restitution={0.56}
        />
        <CuboidCollider
          args={[WALL, wallHalfHeight, ARENA_HALF_DEPTH]}
          position={[bounds.right + WALL, wallCenterY, 0]}
          friction={0.7}
          restitution={0.56}
        />
        <CuboidCollider
          args={[halfWidth, wallHalfHeight, WALL]}
          position={[centerX, wallCenterY, -1.5]}
          restitution={0.46}
        />
        <CuboidCollider
          args={[halfWidth, wallHalfHeight, WALL]}
          position={[centerX, wallCenterY, 1.5]}
          restitution={0.46}
        />
      </RigidBody>
    </>
  );
}

function FloorShadow() {
  return (
    <mesh
      position={[0, -0.44, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[8.3, 3.2]} />
      <shadowMaterial transparent opacity={0.34} depthWrite={false} />
    </mesh>
  );
}

function LandingWeb({ landingRef }: { landingRef: RefObject<LandingState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const lastLandingIdRef = useRef(0);
  const startedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const impactScaleRef = useRef(1);
  const geometry = useMemo(() => createLandingWebGeometry(), []);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    const material = materialRef.current;
    if (!group || !material) return;

    if (landingRef.current.id !== lastLandingIdRef.current) {
      lastLandingIdRef.current = landingRef.current.id;

      if (!landingRef.current.visible) {
        group.visible = false;
        return;
      }

      startedAtRef.current = clock.elapsedTime;
      group.position.x = landingRef.current.x;
      group.position.z = landingRef.current.z;
      impactScaleRef.current = landingRef.current.scale;
      group.visible = true;
    }

    const elapsed = clock.elapsedTime - startedAtRef.current;
    const progress = elapsed / 2.4;
    if (progress < 0) {
      group.visible = false;
      return;
    }

    if (progress >= 1) {
      group.visible = false;
      return;
    }

    const eased = 1 - Math.pow(1 - progress, 3);
    const elasticity = Math.sin(progress * Math.PI * 2.2) * (1 - progress) * 0.015;
    const scale = (0.72 + eased * 0.2) * CUBE_SIZE_SCALE;
    const impactScale = impactScaleRef.current;
    group.scale.set(
      scale * (1 + elasticity) * impactScale,
      scale * (1 - elasticity * 0.45) * impactScale,
      scale * impactScale,
    );
    material.opacity = Math.pow(1 - progress, 1.35) * 0.65;
  });

  return (
    <group
      ref={groupRef}
      visible={false}
      position={[0, FLOOR_SURFACE_Y + 0.012, 0]}
      rotation={[-Math.PI / 2 + 0.14, 0, 0]}
    >
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          ref={materialRef}
          color="#b8f4d4"
          transparent
          opacity={0}
          depthTest
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}

function CubeVisual({ cubeSize }: { cubeSize: number }) {
  const { gl } = useThree();
  const geometry = useMemo(
    () => new RoundedBoxGeometry(cubeSize, cubeSize, cubeSize, 6, cubeSize * 0.07),
    [cubeSize],
  );
  const textures = useMemo(() => FACE_LETTERS.map(createFaceTexture), []);

  useEffect(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    textures.forEach((texture) => {
      texture.anisotropy = Math.min(8, maxAnisotropy);
      texture.needsUpdate = true;
    });
  }, [gl, textures]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {textures.map((texture, index) => (
        <meshStandardMaterial
          key={`${FACE_LETTERS[index]}-${index}`}
          attach={`material-${index}`}
          map={texture}
          color="#ffffff"
          roughness={0.46}
          metalness={0}
          transparent={false}
          opacity={1}
          depthTest
          depthWrite
          side={THREE.FrontSide}
        />
      ))}
    </mesh>
  );
}

function CompactCube({
  reducedMotion,
  anchorFontSizePx,
  anchorNDC,
}: {
  reducedMotion: boolean;
  anchorFontSizePx: number | null;
  anchorNDC: CubeAnchor | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const cubeScale = getFontSizeCubeScale(anchorFontSizePx);
  const cubeSize = CUBE_SIZE * cubeScale;

  const basePosition = useMemo(() => {
    if (!anchorNDC || !size.height) return null;
    const targetZ = -0.3;
    const near = new THREE.Vector3(anchorNDC.x, anchorNDC.y, 0).unproject(camera);
    const far = new THREE.Vector3(anchorNDC.x, anchorNDC.y, 1).unproject(camera);
    const direction = far.sub(near).normalize();
    const distance = (targetZ - near.z) / direction.z;
    const position = near.add(direction.multiplyScalar(distance));
    // Fit the whole spinning cube, even when a front corner is nearest the camera.
    const radius = cubeSize * Math.sqrt(3) / 2;
    const halfHeight = (CAMERA_Z - targetZ) * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
    const halfWidth = halfHeight * (size.width / size.height);
    const safeLeft = -halfWidth + radius * (1 + halfWidth / (CAMERA_Z - targetZ)) + halfWidth * 16 / size.width;
    if (position.x < safeLeft) {
      position.x = safeLeft;
      position.y = camera.position.y + anchorNDC.titleTopY * halfHeight + radius + 0.12;
    }
    return position;
  }, [anchorNDC, camera, cubeSize, size.height, size.width]);

  const rotationAxis = useMemo(
    () => new THREE.Vector3(0.72, 1, 0.38).normalize(),
    [],
  );
  const baseRotation = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, -0.32, -0.08)),
    [],
  );
  const spinRotation = useMemo(() => new THREE.Quaternion(), []);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current || reducedMotion || !basePosition) return;

    // Own clock from clamped deltas: no jump after the canvas was paused.
    timeRef.current += Math.min(delta, MAX_FRAME_DELTA);
    const time = timeRef.current;
    spinRotation.setFromAxisAngle(rotationAxis, time * 0.38);
    groupRef.current.quaternion.copy(baseRotation).premultiply(spinRotation);
    groupRef.current.position.y = basePosition.y + Math.sin(time * 0.7) * 0.06;
  });

  if (!basePosition) return null;

  return (
    <group ref={groupRef} position={[basePosition.x, basePosition.y, basePosition.z]}>
      <CubeVisual cubeSize={cubeSize} />
    </group>
  );
}

function CnuCube({
  reducedMotion,
  pointerRef,
  landingRef,
  landingArmedRef,
  bounds,
}: {
  reducedMotion: boolean;
  pointerRef: RefObject<PointerState>;
  landingRef: RefObject<LandingState>;
  landingArmedRef: RefObject<boolean>;
  bounds: ArenaBounds;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const introCubeRef = useRef<THREE.Group>(null);
  const physicsCubeRef = useRef<THREE.Group>(null);
  // Intro clock accumulated from clamped frame deltas (null until the intro starts).
  const introTimeRef = useRef<number | null>(null);
  const introPlanRef = useRef<IntroPlan | null>(null);
  const hiddenUntilRef = useRef(0);
  const sceneTimeRef = useRef(0);
  const boundsRef = useRef(bounds);
  const introCompleteRef = useRef(reducedMotion);
  const entranceFinishedRef = useRef(false);
  const introLandingCountRef = useRef(0);
  const hoverArmedRef = useRef(true);
  const lastReactionRef = useRef(Number.NEGATIVE_INFINITY);
  const observedPointerRevisionRef = useRef(-1);
  const bouncePendingRef = useRef(false);
  const physicsStartedRef = useRef(false);
  const projectedPosition = useMemo(() => new THREE.Vector3(), []);
  const rotationQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const introFinalQuaternion = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(...CUBE_START_ROTATION)),
    [],
  );
  const introRollQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const introRollAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const rotationMatrix = useMemo(() => new THREE.Matrix4(), []);
  const contactOffset = useMemo(() => new THREE.Vector3(), []);
  const rotatedCorner = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    const entrance = document.querySelector<HTMLElement>("[data-home-entrance]");
    if (!entrance || entrance.dataset.phase === "done" || getComputedStyle(entrance).display === "none") {
      entranceFinishedRef.current = true;
      return;
    }

    const finish = () => { entranceFinishedRef.current = true; };
    entrance.addEventListener(HOME_ENTRANCE_COMPLETE, finish, { once: true });
    return () => entrance.removeEventListener(HOME_ENTRANCE_COMPLETE, finish);
  }, []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const introCube = introCubeRef.current;
    const physicsCube = physicsCubeRef.current;
    if (!body || !introCube || !physicsCube || reducedMotion) return;
    const step = Math.min(delta, MAX_FRAME_DELTA);
    sceneTimeRef.current += step;
    const now = sceneTimeRef.current;

    if (!introCompleteRef.current) {
      if (!entranceFinishedRef.current) return;
      if (introTimeRef.current === null) {
        // Freeze the path for the whole intro and park the (still hidden, weightless)
        // body on the landing pose now, so the hand-off later needs no teleport.
        const plan = buildIntroPlan(boundsRef.current, introFinalQuaternion);
        introPlanRef.current = plan;
        introTimeRef.current = 0;
        const landing = plan.contacts[2];
        body.setTranslation({ x: landing.x, y: landing.centerY, z: CUBE_START_POSITION[2] }, true);
        body.setRotation(introFinalQuaternion, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        introTimeRef.current += step;
      }
      const { startX: introStartX, contacts: introContacts } = introPlanRef.current!;
      const progress = Math.min(introTimeRef.current / CUBE_INTRO_DURATION, 1);
      let x: number;
      let y: number;
      let angle: number;

      if (progress < CUBE_INTRO_FIRST_CONTACT) {
        const phaseProgress = progress / CUBE_INTRO_FIRST_CONTACT;
        const contact = introContacts[0];
        angle = THREE.MathUtils.lerp((Math.PI * 5) / 4, contact.angle, phaseProgress);
        x = THREE.MathUtils.lerp(introStartX, contact.x, phaseProgress);
        y = THREE.MathUtils.lerp(
          CUBE_INTRO_START_Y,
          contact.centerY,
          phaseProgress * phaseProgress,
        );
      } else if (progress < CUBE_INTRO_SECOND_CONTACT) {
        const phaseProgress =
          (progress - CUBE_INTRO_FIRST_CONTACT) /
          (CUBE_INTRO_SECOND_CONTACT - CUBE_INTRO_FIRST_CONTACT);
        const start = introContacts[0];
        const end = introContacts[1];
        angle = THREE.MathUtils.lerp(start.angle, end.angle, phaseProgress);
        x = THREE.MathUtils.lerp(start.x, end.x, phaseProgress);
        y =
          THREE.MathUtils.lerp(start.centerY, end.centerY, phaseProgress) +
          4 * phaseProgress * (1 - phaseProgress) * CUBE_INTRO_HOP_HEIGHT[0];
      } else {
        const phaseProgress =
          (progress - CUBE_INTRO_SECOND_CONTACT) /
          (CUBE_INTRO_FINAL_CONTACT - CUBE_INTRO_SECOND_CONTACT);
        const start = introContacts[1];
        const end = introContacts[2];
        angle = THREE.MathUtils.lerp(start.angle, end.angle, phaseProgress);
        x = THREE.MathUtils.lerp(start.x, end.x, phaseProgress);
        y =
          THREE.MathUtils.lerp(start.centerY, end.centerY, phaseProgress) +
          4 * phaseProgress * (1 - phaseProgress) * CUBE_INTRO_HOP_HEIGHT[1];
      }

      introRollQuaternion.setFromAxisAngle(introRollAxis, angle);
      introCube.quaternion
        .copy(introFinalQuaternion)
        .premultiply(introRollQuaternion);

      introCube.position.set(x, y, CUBE_START_POSITION[2]);

      const reachedLandingCount =
        progress >= CUBE_INTRO_FINAL_CONTACT
          ? 3
          : progress >= CUBE_INTRO_SECOND_CONTACT
            ? 2
            : progress >= CUBE_INTRO_FIRST_CONTACT
              ? 1
              : 0;

      while (introLandingCountRef.current < reachedLandingCount) {
        const contact = introContacts[introLandingCountRef.current];
        landingRef.current.id += 1;
        landingRef.current.x = contact.webX;
        landingRef.current.z = contact.webZ;
        landingRef.current.scale = introLandingCountRef.current === 2 ? 0.82 : 1;
        landingRef.current.visible = true;
        introLandingCountRef.current += 1;
      }

      if (progress >= CUBE_INTRO_FINAL_CONTACT) {
        // Swap visuals only: the body has been resting on this exact pose since the
        // intro began, so there is no teleport and no interpolation ghost.
        introCompleteRef.current = true;
        introCube.visible = false;
        physicsCube.visible = true;
        body.setGravityScale(1, true);
        body.setLinvel({ x: -0.42, y: -0.9, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: -0.52 }, true);
        physicsStartedRef.current = true;
        hoverArmedRef.current = false;
        observedPointerRevisionRef.current = pointerRef.current.revision;
      }
      return;
    }

    if (hiddenUntilRef.current && now >= hiddenUntilRef.current) {
      hiddenUntilRef.current = 0;
      physicsCube.visible = true;
    }

    const translation = body.translation();
    const arena = boundsRef.current;
    if (
      !Number.isFinite(translation.x) ||
      !Number.isFinite(translation.y) ||
      !Number.isFinite(translation.z) ||
      translation.y < -4 ||
      translation.x < leftWallX(arena.left, translation.z) - ARENA_ESCAPE_MARGIN ||
      translation.x > arena.right + ARENA_ESCAPE_MARGIN ||
      Math.abs(translation.z) > 3
    ) {
      const landingX = THREE.MathUtils.clamp(
        arena.landing ?? CUBE_START_POSITION[0],
        arena.left + CUBE_SIZE * 0.6,
        arena.right - CUBE_SIZE * 0.6,
      );
      body.setTranslation(
        { x: landingX, y: CUBE_START_POSITION[1], z: CUBE_START_POSITION[2] },
        true,
      );
      physicsCube.visible = false;
      hiddenUntilRef.current = now + TELEPORT_HIDE_SECONDS;
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0.4, y: -0.25, z: 0.3 }, true);
      hoverArmedRef.current = true;
      landingArmedRef.current = false;
      bouncePendingRef.current = false;
      return;
    }

    const verticalVelocity = body.linvel().y;

    if (bouncePendingRef.current || landingArmedRef.current) {
      const rotation = body.rotation();
      rotationQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      rotationMatrix.makeRotationFromQuaternion(rotationQuaternion);
      const elements = rotationMatrix.elements;
      const halfExtentY =
        (CUBE_SIZE / 2) *
        (Math.abs(elements[1]) + Math.abs(elements[5]) + Math.abs(elements[9]));
      const bottomY = translation.y - halfExtentY;

      if (bouncePendingRef.current) {
        if (bottomY > FLOOR_SURFACE_Y + AIRBORNE_CLEARANCE) {
          landingArmedRef.current = true;
          bouncePendingRef.current = false;
        } else if (verticalVelocity <= 0) {
          bouncePendingRef.current = false;
        }
      }

      if (landingArmedRef.current && verticalVelocity < -0.2 && bottomY < -0.38) {
        const halfSize = CUBE_SIZE / 2;
        let lowestY = Number.POSITIVE_INFINITY;
        let contactCount = 0;
        contactOffset.set(0, 0, 0);

        for (const x of [-halfSize, halfSize]) {
          for (const y of [-halfSize, halfSize]) {
            for (const z of [-halfSize, halfSize]) {
              rotatedCorner.set(x, y, z).applyMatrix4(rotationMatrix);

              if (rotatedCorner.y < lowestY - 0.025) {
                lowestY = rotatedCorner.y;
                contactOffset.copy(rotatedCorner);
                contactCount = 1;
              } else if (Math.abs(rotatedCorner.y - lowestY) <= 0.025) {
                contactOffset.add(rotatedCorner);
                contactCount += 1;
              }
            }
          }
        }

        contactOffset.divideScalar(contactCount);
        landingRef.current.id += 1;
        landingRef.current.x = translation.x + contactOffset.x;
        landingRef.current.z = translation.z + contactOffset.z;
        landingRef.current.scale = 1;
        landingRef.current.visible = true;
        landingArmedRef.current = false;
      }
    }

    const angularVelocity = body.angvel();
    const angularSpeed = Math.hypot(
      angularVelocity.x,
      angularVelocity.y,
      angularVelocity.z,
    );
    if (angularSpeed > 3.4) {
      const scale = 3.4 / angularSpeed;
      body.setAngvel(
        {
          x: angularVelocity.x * scale,
          y: angularVelocity.y * scale,
          z: angularVelocity.z * scale,
        },
        true,
      );
    }

    const pointer = pointerRef.current;
    if (!pointer.active) {
      hoverArmedRef.current = true;
      observedPointerRevisionRef.current = pointer.revision;
      return;
    }

    projectedPosition.set(translation.x, translation.y, translation.z).project(camera);
    const dx = projectedPosition.x - pointer.x;
    const dy = projectedPosition.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const pointerMoved = pointer.revision !== observedPointerRevisionRef.current;
    observedPointerRevisionRef.current = pointer.revision;

    if (
      !hoverArmedRef.current &&
      pointerMoved &&
      distance > HOVER_RESET_RADIUS
    ) {
      hoverArmedRef.current = true;
    }

    if (
      !hoverArmedRef.current ||
      distance >= HOVER_TRIGGER_RADIUS ||
      now - lastReactionRef.current < MIN_REACTION_INTERVAL
    ) {
      return;
    }

    hoverArmedRef.current = false;
    lastReactionRef.current = now;

    if (!physicsStartedRef.current) {
      body.setGravityScale(1, true);
      physicsStartedRef.current = true;
    }

    const xDirection = dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(dx);
    const depthDirection = Math.random() > 0.5 ? 1 : -1;

    body.setLinvel(
      {
        x: xDirection * 2.65,
        y: 2.15,
        z: depthDirection * 0.42,
      },
      true,
    );
    landingArmedRef.current = false;
    bouncePendingRef.current = true;
    body.setAngvel(
      {
        x: (Math.random() - 0.5) * 1.8,
        y: (Math.random() - 0.5) * 1.4,
        z: -xDirection * 2.9,
      },
      true,
    );
  });

  return (
    <>
      <group
        ref={introCubeRef}
        visible={!reducedMotion}
        position={INTRO_IDLE_POSITION}
        rotation={CUBE_START_ROTATION}
      >
        <CubeVisual cubeSize={CUBE_SIZE} />
      </group>
      <RigidBody
        ref={bodyRef}
        type={reducedMotion ? "fixed" : "dynamic"}
        colliders={false}
        position={CUBE_START_POSITION}
        rotation={CUBE_START_ROTATION}
        gravityScale={0}
        linearDamping={0.42}
        angularDamping={0.46}
        friction={0.8}
        restitution={0.48}
        ccd
        additionalSolverIterations={2}
        canSleep
      >
        <CuboidCollider args={[CUBE_SIZE / 2, CUBE_SIZE / 2, CUBE_SIZE / 2]} />
        <group ref={physicsCubeRef} visible={reducedMotion}>
          <CubeVisual cubeSize={CUBE_SIZE} />
        </group>
      </RigidBody>
    </>
  );
}

function PhysicsCubeWorld({
  reducedMotion,
  pointerRef,
  bounds,
}: {
  reducedMotion: boolean;
  pointerRef: RefObject<PointerState>;
  bounds: ArenaBounds;
}) {
  const landingRef = useRef<LandingState>({
    id: 0,
    x: 0,
    z: 0,
    scale: 1,
    visible: false,
  });
  const landingArmedRef = useRef(false);

  return (
    <Physics gravity={[0, -6.2, 0]} timeStep={1 / 60} interpolate>
      <Arena bounds={bounds} />
      <FloorShadow />
      <LandingWeb landingRef={landingRef} />
      <CnuCube
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        landingRef={landingRef}
        landingArmedRef={landingArmedRef}
        bounds={bounds}
      />
    </Physics>
  );
}

function CubeWorld({
  reducedMotion,
  pointerRef,
  viewportWidth,
  mobileLikeDevice,
  anchorNDC,
  anchorFontSizePx,
  bounds,
}: {
  reducedMotion: boolean;
  pointerRef: RefObject<PointerState>;
  viewportWidth: number | null;
  mobileLikeDevice: boolean | null;
  anchorNDC: CubeAnchor | null;
  anchorFontSizePx: number | null;
  bounds: ArenaBounds;
}) {
  if (viewportWidth === null || mobileLikeDevice === null) {
    return null;
  }

  const compact = viewportWidth < 720 || mobileLikeDevice;
  const hideCompactCube = viewportWidth < 375;

  if (hideCompactCube) {
    return null;
  }

  if (compact) {
    return (
      <CompactCube
        reducedMotion={reducedMotion}
        anchorFontSizePx={anchorFontSizePx}
        anchorNDC={anchorNDC}
      />
    );
  }

  return <PhysicsCubeWorld reducedMotion={reducedMotion} pointerRef={pointerRef} bounds={bounds} />;
}

export function HomeHeroScene() {
  const reducedMotion = useReducedMotion();
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [mobileLikeDevice, setMobileLikeDevice] = useState<boolean | null>(null);

  const [anchorNDC, setAnchorNDC] = useState<CubeAnchor | null>(null);
  const [anchorFontSizePx, setAnchorFontSizePx] = useState<number | null>(null);
  const pointerRef = useRef<PointerState>({ active: false, x: 0, y: 0, revision: 0 });
  // Optional framing from the page: the cube rolls on [data-hero-floor] (its top edge),
  // between that element's left edge and the left edge of [data-hero-bound-right].
  const [cameraY, setCameraY] = useState(0);
  const [arenaBounds, setArenaBounds] = useState<ArenaBounds>(DEFAULT_ARENA_BOUNDS);
  // Stop rendering (and stepping physics) while the hero is scrolled out of view.
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const hero = containerRef.current?.closest<HTMLElement>("[data-home-hero]");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "120px 0px",
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    const touchOnlyQuery = window.matchMedia("(pointer: coarse) and (hover: none)");
    const updateMobileLikeDevice = () => {
      const smallTouchScreen =
        navigator.maxTouchPoints > 0 &&
        Math.min(window.screen.width, window.screen.height) <= 900;

      setMobileLikeDevice(touchOnlyQuery.matches || smallTouchScreen);
    };
    const updateAnchor = () => {
      const anchorEl = document.querySelector<HTMLElement>("[data-hero-anchor]");
      const heroEl = anchorEl?.closest<HTMLElement>("[data-home-hero]");
      if (!anchorEl || !heroEl) {
        setAnchorNDC(null);
        setAnchorFontSizePx(null);
        return;
      }
      const anchorRect = anchorEl.getBoundingClientRect();
      const heroRect = heroEl.getBoundingClientRect();
      const px = anchorRect.left - heroRect.left;
      const py = anchorRect.top - heroRect.top + anchorRect.height / 2;
      const titleTop = anchorEl.closest("h1")?.getBoundingClientRect().top ?? anchorRect.top;
      setAnchorNDC({
        x: (px / heroRect.width) * 2 - 1,
        y: -((py / heroRect.height) * 2 - 1),
        titleTopY: -(((titleTop - heroRect.top) / heroRect.height) * 2 - 1),
      });
      setAnchorFontSizePx(parseFloat(getComputedStyle(anchorEl).fontSize));
    };
    const updateFraming = () => {
      const heroEl = document.querySelector<HTMLElement>("[data-home-hero]");
      const floorEl = heroEl?.querySelector<HTMLElement>("[data-hero-floor]");
      const rightEl = heroEl?.querySelector<HTMLElement>("[data-hero-bound-right]");
      const heroRect = heroEl?.getBoundingClientRect();
      const floorRect = floorEl?.getBoundingClientRect();
      const rightRect = rightEl?.getBoundingClientRect();
      if (!heroEl || !heroRect?.width || !heroRect.height) {
        setCameraY(0);
        setArenaBounds((prev) => (prev === DEFAULT_ARENA_BOUNDS ? prev : DEFAULT_ARENA_BOUNDS));
        return;
      }

      const halfWidth = VISIBLE_HALF_HEIGHT * (heroRect.width / heroRect.height);
      const toNdcX = (x: number) => ((x - heroRect.left) / heroRect.width) * 2 - 1;
      const hasRuler = !!floorRect?.width;
      const gutter = Number.parseFloat(getComputedStyle(heroEl).getPropertyValue("--deep-gutter")) || 20;
      const nextCameraY = hasRuler
        ? FLOOR_SURFACE_Y +
          (((floorRect.top - FLOOR_RAISE_PX - heroRect.top) / heroRect.height) * 2 - 1) * VISIBLE_HALF_HEIGHT
        : 0;
      setCameraY((prev) => (Math.abs(prev - nextCameraY) < 1e-3 ? prev : nextCameraY));
      // Land between the first stat's text and the second stat ([data-hero-landing] items).
      const landingEls = heroEl?.querySelectorAll<HTMLElement>("[data-hero-landing]");
      let landing: number | undefined;
      if (landingEls && landingEls.length >= 2) {
        const fromRight = Math.max(
          ...Array.from(landingEls[0].children).map((child) => child.getBoundingClientRect().right),
        );
        const toLeft = landingEls[1].getBoundingClientRect().left;
        landing = toNdcX((fromRight + toLeft) / 2) * halfWidth;
      }
      const next: ArenaBounds = {
        left: toNdcX(hasRuler ? floorRect.left : heroRect.left + gutter) * halfWidth,
        right: toNdcX(hasRuler && rightRect?.width ? rightRect.left : heroRect.right - gutter) * halfWidth,
        landing,
      };
      // Only replace the bounds when they really moved: a new object rebuilds the colliders.
      setArenaBounds((prev) =>
        Math.abs(prev.left - next.left) < 1e-3 &&
        Math.abs(prev.right - next.right) < 1e-3 &&
        Math.abs((prev.landing ?? 0) - (next.landing ?? 0)) < 1e-3 &&
        (prev.landing === undefined) === (next.landing === undefined)
          ? prev
          : next,
      );
    };

    updateViewportWidth();
    updateMobileLikeDevice();
    updateAnchor();
    updateFraming();
    const heroForObserver = document.querySelector<HTMLElement>("[data-home-hero]");
    const framingObserver = new ResizeObserver(() => updateFraming());
    if (heroForObserver) framingObserver.observe(heroForObserver);
    window.addEventListener("resize", updateViewportWidth, { passive: true });
    window.addEventListener("resize", updateAnchor, { passive: true });
    window.addEventListener("resize", updateFraming, { passive: true });
    window.addEventListener("orientationchange", updateMobileLikeDevice);
    window.addEventListener("orientationchange", updateAnchor);
    touchOnlyQuery.addEventListener("change", updateMobileLikeDevice);
    return () => {
      window.removeEventListener("resize", updateViewportWidth);
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("resize", updateFraming);
      framingObserver.disconnect();
      window.removeEventListener("orientationchange", updateMobileLikeDevice);
      window.removeEventListener("orientationchange", updateAnchor);
      touchOnlyQuery.removeEventListener("change", updateMobileLikeDevice);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target;
      const hero = target instanceof Element
        ? target.closest<HTMLElement>("[data-home-hero]")
        : null;

      if (!hero) {
        pointerRef.current = {
          ...pointerRef.current,
          active: false,
          revision: pointerRef.current.revision + 1,
        };
        return;
      }

      const bounds = hero.getBoundingClientRect();

      pointerRef.current = {
        active: true,
        x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        y: -(((event.clientY - bounds.top) / bounds.height) * 2 - 1),
        revision: pointerRef.current.revision + 1,
      };
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 [&_canvas]:h-full [&_canvas]:w-full"
      aria-hidden="true"
    >
      <Canvas
        shadows
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? "demand" : inView ? "always" : "never"}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={1.05} />
        <hemisphereLight args={["#e2f3e8", "#172b21", 1.65]} />
        <directionalLight
          castShadow
          position={[-4, 6, 6]}
          intensity={3.5}
          color="#f7fffa"
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[3, -1, 4]} intensity={8} color="#5fc391" distance={10} />
        <pointLight position={[-3, 1, 3]} intensity={4} color="#c2ead0" distance={9} />
        <fog attach="fog" args={["#14231b", 8.7, 13.8]} />
        <CameraRig offsetY={cameraY} />
        <ClockGuard running={inView} />
        <Suspense fallback={null}>
          <CubeWorld
            reducedMotion={reducedMotion}
            pointerRef={pointerRef}
            viewportWidth={viewportWidth}
            mobileLikeDevice={mobileLikeDevice}
            anchorNDC={anchorNDC}
            anchorFontSizePx={anchorFontSizePx}
            bounds={arenaBounds}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
