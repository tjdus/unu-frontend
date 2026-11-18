export const ringWidth = 514;
export const ringHeight = 362;
export const ringLevels = [0.15, 0.215, 0.28, 0.36, 0.44, 0.53, 0.62, 0.712, 0.805, 0.902, 1];
export const ringSpokeOpacity = 0.36;

export function ringStrokeOpacity(index: number, selected: number) {
  return index === selected ? 1 : index % 2 === 0 ? 0.74 : 0.56;
}

type Point = [x: number, y: number, lift: number];

export function ringPoint(level: number, angle: number): Point {
  const phase = level * 2.1;
  const shape = 1 + 0.055 * Math.sin(3 * angle + 0.8 + phase)
    + 0.038 * Math.cos(5 * angle + 0.4 - phase) + 0.018 * Math.sin(8 * angle);
  const radius = 225 * level * shape;
  // A shallow relief keeps the projected contours nested on the far side.
  const lift = 36 * (1 - level) ** 1.35 + 14 * Math.exp(-(((level - 0.44) / 0.35) ** 2))
    + 6 * Math.sin(3 * angle + 0.5) * Math.sin(Math.PI * level)
    + 3 * Math.sin(5 * angle - 2.2 * level) * level;

  return [radius * Math.cos(angle), radius * Math.sin(angle), lift];
}

// Keep the fallback SVG and the WebGL camera in the same composition.
export const ringProjection = {
  centerX: 250,
  centerY: 183,
  depthY: 0.29,
  depthZ: 0.16,
  focalLength: 695,
  skewX: 0.16,
  skewY: 0.17,
  pitch: 0.66,
};

export function projectRingPoint([x, y, lift]: Point) {
  const p = ringProjection;
  const depth = 1 + (y * p.depthY - lift * p.depthZ) / p.focalLength;
  return [p.centerX + (x + p.skewX * y) / depth, p.centerY + (p.pitch * y - p.skewY * x - lift) / depth];
}

export const ringContours = ringLevels.map((level) => (
  Array.from({ length: 128 }, (_, index) => ringPoint(level, index * Math.PI / 64))
));

export const ringSpokes = Array.from({ length: 22 }, (_, index) => (
  Array.from({ length: 34 }, (_, step) => (
    ringPoint(ringLevels[0] + (1 - ringLevels[0]) * step / 33, index * Math.PI / 11)
  ))
));
