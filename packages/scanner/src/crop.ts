export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes the region of the source video frame that corresponds to a centered square
 * scan area on screen, for a video element rendered with `object-fit: cover`.
 *
 * @param roiFraction side of the on-screen square relative to the shorter display side (0–1].
 */
export function computeCropRect(video: Size, display: Size, roiFraction: number): Rect {
  const fraction = Math.min(Math.max(roiFraction, 0.05), 1);
  // object-fit: cover scales the video so that it fills the display.
  const scale = Math.max(display.width / video.width, display.height / video.height);
  const visibleW = display.width / scale;
  const visibleH = display.height / scale;
  const side = Math.min(visibleW, visibleH) * fraction;
  return {
    x: Math.round((video.width - side) / 2),
    y: Math.round((video.height - side) / 2),
    width: Math.round(side),
    height: Math.round(side),
  };
}

/** Output size for decoding: the crop scaled down so that its longer side is at most `maxSide`. */
export function fitWithin(size: Size, maxSide: number): Size {
  const factor = Math.min(1, maxSide / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * factor)),
    height: Math.max(1, Math.round(size.height * factor)),
  };
}
