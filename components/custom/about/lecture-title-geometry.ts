import { ExtrudeGeometry, ShapePath } from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

const WIDTH = 426;
const HEIGHT = 160;
const SIZE = 108;
const SCALE = 2;
// Shallow block: the sides read as depth behind the letters, not as an outline around them.
const DEPTH = 36;
// Bold (not black) with a little tracking keeps counters open and letters apart once the
// sides show.
const WEIGHT = 700;
const TRACKING = 0.02; // em
const ISO = 127.5;

type Point = [number, number];
type Vertex = { point: Point; adjacent: number[] };

const segments: [number, number][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]],
  [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]],
  [[1, 3]], [[0, 1]], [[3, 0]], [],
];

function simplifyContour(points: Point[]) {
  const closed = [...points, points[0]];
  const keep = new Set([0, points.length]);
  const ranges: [number, number][] = [[0, points.length]];
  while (ranges.length) {
    const [start, end] = ranges.pop()!;
    const [x, y] = closed[start];
    const dx = closed[end][0] - x;
    const dy = closed[end][1] - y;
    const lengthSquared = dx * dx + dy * dy;
    let farthest = -1;
    let threshold = 0.5 ** 2;
    for (let i = start + 1; i < end; i++) {
      const ox = closed[i][0] - x;
      const oy = closed[i][1] - y;
      const t = lengthSquared ? Math.min(1, Math.max(0, (ox * dx + oy * dy) / lengthSquared)) : 0;
      const distance = (ox - t * dx) ** 2 + (oy - t * dy) ** 2;
      if (distance > threshold) {
        threshold = distance;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep.add(farthest);
      ranges.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, index) => keep.has(index));
}

function traceContours({ data, width, height }: ImageData) {
  const vertices = new Map<number, Vertex>();
  const count = width * height;
  const alpha = (index: number) => data[index * 4 + 3];
  const vertex = (index: number, vertical: boolean) => {
    const key = index + (vertical ? count : 0);
    if (!vertices.has(key)) {
      const start = alpha(index);
      const offset = (ISO - start) / (alpha(index + (vertical ? width : 1)) - start);
      vertices.set(key, {
        point: [index % width + (vertical ? 0 : offset), Math.floor(index / width) + (vertical ? offset : 0)],
        adjacent: [],
      });
    }
    return key;
  };

  // March the text alpha boundary, using one shared vertex for each cell edge.
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const index = y * width + x;
      const a = alpha(index);
      const b = alpha(index + 1);
      const c = alpha(index + width + 1);
      const d = alpha(index + width);
      const mask = Number(a > ISO) | Number(b > ISO) << 1 | Number(c > ISO) << 2 | Number(d > ISO) << 3;
      if (!mask || mask === 15) continue;
      const edge = (side: number) => side === 0 ? vertex(index, false)
        : side === 1 ? vertex(index + 1, true) : side === 2 ? vertex(index + width, false) : vertex(index, true);
      const links = (mask === 5 || mask === 10) && a + b + c + d > ISO * 4
        ? segments[15 ^ mask] : segments[mask];
      for (const [start, end] of links) {
        const from = edge(start);
        const to = edge(end);
        vertices.get(from)!.adjacent.push(to);
        vertices.get(to)!.adjacent.push(from);
      }
    }
  }

  const seen = new Set<number>();
  const outlines = new ShapePath();
  outlines.userData.style = { fillRule: "evenodd" };
  for (const start of vertices.keys()) {
    if (seen.has(start)) continue;
    const points: Point[] = [];
    let previous = -1;
    let current: number | undefined = start;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      const { point, adjacent }: Vertex = vertices.get(current)!;
      points.push(point);
      const next: number | undefined = adjacent.find((id: number) => id !== previous);
      previous = current;
      current = next;
    }
    if (current !== start || points.length < 4) continue;
    const contour = simplifyContour(points);
    if (contour.length < 3) continue;
    contour.forEach(([x, y], index) => {
      const px = x / SCALE - WIDTH / 2;
      const py = HEIGHT / 2 - y / SCALE;
      if (index === 0) outlines.moveTo(px, py);
      else outlines.lineTo(px, py);
    });
    outlines.currentPath?.closePath();
  }
  return outlines.toShapes();
}

export function makeTitleGeometry(title: string, family: string) {
  const surface = document.createElement("canvas");
  surface.width = WIDTH * SCALE;
  surface.height = HEIGHT * SCALE;
  const context = surface.getContext("2d");
  if (!context) throw new Error("Could not read the lecture title outline");

  context.scale(SCALE, SCALE);
  context.font = `${WEIGHT} ${SIZE}px ${family}`;
  context.letterSpacing = `${SIZE * TRACKING}px`;
  const text = title.trim().replace(/\s+/g, " ");
  const widthOf = (line: string) => context.measureText(line).width;
  const maxWidth = WIDTH - 26;
  let lines = [text];
  let maxSize = SIZE;
  const words = text.split(" ");
  if (widthOf(text) > maxWidth * 1.7 && words.length > 1) {
    let bestWidth = Infinity;
    for (let i = 1; i < words.length; i++) {
      const pair = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      const width = Math.max(...pair.map(widthOf));
      if (width < bestWidth) {
        bestWidth = width;
        lines = pair;
      }
    }
    maxSize = 64;
  }
  const size = Math.min(maxSize, SIZE * maxWidth / Math.max(1, ...lines.map(widthOf)));
  const lineHeight = size * 1.08;
  context.font = `${WEIGHT} ${size}px ${family}`;
  context.letterSpacing = `${size * TRACKING}px`;
  context.textAlign = "center";
  lines.forEach((line, index) => {
    const metrics = context.measureText(line);
    const centerY = HEIGHT / 2 + (index - (lines.length - 1) / 2) * lineHeight;
    context.fillText(line, WIDTH / 2, centerY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
  });

  const shapes = traceContours(context.getImageData(0, 0, surface.width, surface.height));
  if (!shapes.length) throw new Error("The lecture title has no visible outline");
  const geometry = new ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false });
  geometry.translate(0, 0, -DEPTH);
  return toCreasedNormals(geometry, Math.PI / 6);
}
