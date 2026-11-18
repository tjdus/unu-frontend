import {
  BufferGeometry,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { makeTitleGeometry } from "./lecture-title-geometry";

const WIDTH = 484;
const HEIGHT = 250;
// A calm three-quarter view: the block shows below and to the left of the face, in one
// direction, the way extruded display type is usually set — the face stays fully readable.
const BASE_PITCH = MathUtils.degToRad(14);
const BASE_YAW = MathUtils.degToRad(-22);
// M3 elevation: one soft key shadow under the lettering, drawn when compositing.
const SHADOW = { color: "rgba(4, 28, 16, 0.32)", blur: 22, offsetY: 12 };

function createStage(faceColor: string) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.round(WIDTH * scale);
  const height = Math.round(HEIGHT * scale);
  renderer.setSize(width, height, false);
  const camera = new OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 1, 500);
  camera.position.z = 200;
  const scene = new Scene();
  const empty = new BufferGeometry();
  const materials = [
    new MeshBasicMaterial({ color: faceColor, toneMapped: false }),
    // Tonal sides: a darker step of the same green, lit softly so they read as depth.
    new MeshLambertMaterial({ color: "#679c7b", toneMapped: false }),
  ];
  const lettering = new Mesh(empty, materials);
  const key = new DirectionalLight("#edf7ed", 1.9);
  key.position.set(2, 4, 2);
  scene.add(lettering, key, new HemisphereLight("#e4f3df", "#2d6046", 1.7));
  return { renderer, camera, scene, lettering, empty, materials, width, height, users: 0 };
}

let sharedStage: ReturnType<typeof createStage> | undefined;

export function makeLectureTitle(canvas: HTMLCanvasElement, title: string, family: string, faceColor: string) {
  const output = canvas.getContext("2d");
  if (!output) throw new Error("Could not display the lecture title");
  const geometry = makeTitleGeometry(title, family);
  let stage: ReturnType<typeof createStage>;
  try {
    stage = sharedStage ??= createStage(faceColor);
  } catch (error) {
    geometry.dispose();
    throw error;
  }
  stage.users++;
  const { width, height } = stage;
  canvas.width = width;
  canvas.height = height;

  return {
    render(pitch: number, yaw: number, lift: number) {
      if (stage.renderer.getContext().isContextLost()) return false;
      stage.lettering.geometry = geometry;
      stage.lettering.position.y = lift;
      stage.lettering.rotation.set(BASE_PITCH + pitch, BASE_YAW + yaw, 0);
      stage.renderer.render(stage.scene, stage.camera);
      output.clearRect(0, 0, width, height);
      const pixel = width / WIDTH;
      output.shadowColor = SHADOW.color;
      output.shadowBlur = SHADOW.blur * pixel;
      output.shadowOffsetY = SHADOW.offsetY * pixel;
      output.drawImage(stage.renderer.domElement, 0, 0);
      return true;
    },
    dispose() {
      if (stage.lettering.geometry === geometry) stage.lettering.geometry = stage.empty;
      geometry.dispose();
      if (--stage.users > 0) return;
      stage.empty.dispose();
      stage.materials.forEach((material) => material.dispose());
      stage.renderer.dispose();
      sharedStage = undefined;
    },
  };
}
