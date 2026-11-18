import {
  BufferGeometry,
  Camera,
  Color,
  Float32BufferAttribute,
  LineLoop,
  LineSegments,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import {
  ringContours,
  ringHeight,
  ringProjection,
  ringSpokes,
  ringSpokeOpacity,
  ringStrokeOpacity,
  ringWidth,
} from "./people-ring-geometry";

const p = ringProjection;
const vertexShader = `
  void main() {
    float depth = 1.0 + (position.y * ${p.depthY} - position.z * ${p.depthZ}) / ${p.focalLength}.0;
    vec2 pixel = vec2(
      ${p.centerX}.0 + (position.x + ${p.skewX} * position.y) / depth,
      ${p.centerY}.0 + (${p.pitch} * position.y - ${p.skewY} * position.x - position.z) / depth
    );
    gl_Position = vec4(pixel.x * 2.0 / ${ringWidth}.0 - 1.0, 1.0 - pixel.y * 2.0 / ${ringHeight}.0, 0.0, 1.0);
  }
`;

function makeLineMaterial(color: Color, opacity: number) {
  return new ShaderMaterial({
    uniforms: { lineColor: { value: color.clone() }, lineOpacity: { value: opacity } },
    vertexShader,
    fragmentShader: `
      uniform vec3 lineColor;
      uniform float lineOpacity;
      void main() {
        gl_FragColor = vec4(lineColor, lineOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

function makeGeometry(points: number[]) {
  return new BufferGeometry().setAttribute("position", new Float32BufferAttribute(points, 3));
}

export function makeRingRenderer(canvas: HTMLCanvasElement, outline: string, accent: string) {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  const camera = new Camera();
  const scene = new Scene();
  const baseColor = new Color(outline);
  const accentColor = new Color(accent);
  const spokes = new LineSegments(
    makeGeometry(ringSpokes.flatMap((points) => points.slice(1).flatMap((point, index) => [...points[index], ...point]))),
    makeLineMaterial(baseColor, ringSpokeOpacity),
  );
  const contours = ringContours.map((points, index) => new LineLoop(
    makeGeometry(points.flat()),
    makeLineMaterial(baseColor, ringStrokeOpacity(index, -1)),
  ));
  for (const line of [spokes, ...contours]) {
    line.frustumCulled = false;
    scene.add(line);
  }

  return {
    resize(width: number, height: number) {
      renderer.setSize(width, height, false);
    },
    render(selected: number) {
      contours.forEach((line, index) => {
        const active = index === selected;
        line.material.uniforms.lineColor.value.copy(active ? accentColor : baseColor);
        line.material.uniforms.lineOpacity.value = ringStrokeOpacity(index, selected);
        line.renderOrder = active ? 1 : 0;
      });
      renderer.render(scene, camera);
    },
    dispose() {
      for (const line of [spokes, ...contours]) {
        line.geometry.dispose();
        line.material.dispose();
      }
      renderer.dispose();
    },
  };
}
