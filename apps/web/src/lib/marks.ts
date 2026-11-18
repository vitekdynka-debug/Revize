import type { Rotation } from './crop.js';

/**
 * Red marks drawn into a defect photo to point at the defect: an arrow or a circle. Positions
 * are fractions (0–1) of the image as shown, i.e. after the rotation (like the crop); sizes are
 * fractions of the shorter side, so a mark keeps its look when the photo is turned.
 */
export type PhotoMark =
  | { kind: 'arrow'; tipX: number; tipY: number; tailX: number; tailY: number }
  | { kind: 'circle'; x: number; y: number; r: number };

export const MARK_COLOR = '#e03131';
/** Line width as a fraction of the shorter side. */
const LINE = 0.012;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A new arrow pointing at the middle of the shown part (tail down to the left). */
export function newArrow(cx: number, cy: number, width: number, height: number): PhotoMark {
  const short = Math.min(width, height);
  const length = 0.22 * short;
  return {
    kind: 'arrow',
    tipX: cx,
    tipY: cy,
    tailX: clamp01(cx - (length * Math.SQRT1_2) / width),
    tailY: clamp01(cy + (length * Math.SQRT1_2) / height),
  };
}

export function newCircle(cx: number, cy: number): PhotoMark {
  return { kind: 'circle', x: cx, y: cy, r: 0.12 };
}

/** The mark moved by dx, dy (fractions of the shown image). */
export function moveMark(mark: PhotoMark, dx: number, dy: number): PhotoMark {
  if (mark.kind === 'circle') return { ...mark, x: clamp01(mark.x + dx), y: clamp01(mark.y + dy) };
  return {
    ...mark,
    tipX: clamp01(mark.tipX + dx),
    tipY: clamp01(mark.tipY + dy),
    tailX: clamp01(mark.tailX + dx),
    tailY: clamp01(mark.tailY + dy),
  };
}

/** The same mark after turning the photo by 90° (positions move like the crop does). */
export function rotateMark(mark: PhotoMark, clockwise: boolean): PhotoMark {
  const point = (x: number, y: number): [number, number] => (clockwise ? [1 - y, x] : [y, 1 - x]);
  if (mark.kind === 'circle') {
    const [x, y] = point(mark.x, mark.y);
    return { ...mark, x, y };
  }
  const [tipX, tipY] = point(mark.tipX, mark.tipY);
  const [tailX, tailY] = point(mark.tailX, mark.tailY);
  return { kind: 'arrow', tipX, tipY, tailX, tailY };
}

/** Rotations applied one after another (the marks of a photo turned several times). */
export function rotateMarks(marks: readonly PhotoMark[], from: Rotation, to: Rotation) {
  let turns = ((to - from + 360) % 360) / 90;
  let result = [...marks];
  while (turns-- > 0) result = result.map((m) => rotateMark(m, true));
  return result;
}

/**
 * The shapes of a mark in pixels of an image of `width` × `height`: lines (shaft and the two
 * sides of the head) or a circle. Shared by the editor (SVG) and the saved photo (canvas).
 */
export function markGeometry(mark: PhotoMark, width: number, height: number) {
  const short = Math.min(width, height);
  const line = Math.max(2, LINE * short);
  if (mark.kind === 'circle') {
    return {
      line,
      circle: { cx: mark.x * width, cy: mark.y * height, r: Math.max(line * 2, mark.r * short) },
      lines: [] as [number, number, number, number][],
    };
  }
  const tip = { x: mark.tipX * width, y: mark.tipY * height };
  const tail = { x: mark.tailX * width, y: mark.tailY * height };
  const angle = Math.atan2(tail.y - tip.y, tail.x - tip.x);
  const head = Math.max(line * 3, 0.06 * short);
  const side = (delta: number) =>
    [
      tip.x,
      tip.y,
      tip.x + head * Math.cos(angle + delta),
      tip.y + head * Math.sin(angle + delta),
    ] as [number, number, number, number];
  return {
    line,
    circle: null,
    lines: [[tail.x, tail.y, tip.x, tip.y], side(0.5), side(-0.5)] as [
      number,
      number,
      number,
      number,
    ][],
  };
}

/** Draws the marks on a canvas whose coordinates are pixels of the shown (turned) image. */
export function drawMarks(
  context: CanvasRenderingContext2D,
  marks: readonly PhotoMark[],
  width: number,
  height: number,
): void {
  for (const mark of marks) {
    const shape = markGeometry(mark, width, height);
    // A light halo under the red line keeps it visible on dark and red backgrounds.
    for (const [color, extra] of [
      ['rgba(255,255,255,0.85)', shape.line * 0.8],
      [MARK_COLOR, 0],
    ] as const) {
      context.strokeStyle = color;
      context.lineWidth = shape.line + extra;
      context.lineCap = 'round';
      context.beginPath();
      if (shape.circle) {
        context.arc(shape.circle.cx, shape.circle.cy, shape.circle.r, 0, Math.PI * 2);
      }
      for (const [x1, y1, x2, y2] of shape.lines) {
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
      }
      context.stroke();
    }
  }
}
