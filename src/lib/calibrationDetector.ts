export type CalibrationObjectType = 'a4' | 'card';

export interface CalibrationCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export interface CalibrationDetectionResult {
  objectType: CalibrationObjectType;
  corners: CalibrationCorners;
  confidence: number;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function averageEdgeLength(corners: CalibrationCorners): { widthPx: number; heightPx: number } {
  const top = distance(corners.topLeft, corners.topRight);
  const bottom = distance(corners.bottomLeft, corners.bottomRight);
  const left = distance(corners.topLeft, corners.bottomLeft);
  const right = distance(corners.topRight, corners.bottomRight);
  return {
    widthPx: (top + bottom) / 2,
    heightPx: (left + right) / 2,
  };
}

/**
 * Simple detector for rectangular reference objects. It finds the largest high-contrast
 * connected component and estimates a bounding rectangle.
 */
export function detectCalibrationObjectFromImageData(
  imageData: ImageData,
): CalibrationDetectionResult | null {
  const { width, height, data } = imageData;
  if (width < 32 || height < 32) {
    return null;
  }

  const luminance = new Uint8ClampedArray(width * height);
  let sum = 0;
  for (let i = 0; i < width * height; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    luminance[i] = y;
    sum += y;
  }
  const mean = sum / (width * height);
  const threshold = Math.max(35, Math.min(220, mean - 12));

  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) {
    // dark object over brighter floor/background
    mask[i] = luminance[i] < threshold ? 1 : 0;
  }

  const visited = new Uint8Array(width * height);
  let bestArea = 0;
  let bestMinX = 0;
  let bestMinY = 0;
  let bestMaxX = 0;
  let bestMaxY = 0;

  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);

  const neighbors = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1],
  ] as const;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      if (!mask[idx] || visited[idx]) continue;

      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail += 1;
      visited[idx] = 1;

      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (head < tail) {
        const cx = queueX[head];
        const cy = queueY[head];
        head += 1;
        area += 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of neighbors) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (!mask[nIdx] || visited[nIdx]) continue;
          visited[nIdx] = 1;
          queueX[tail] = nx;
          queueY[tail] = ny;
          tail += 1;
        }
      }

      if (area > bestArea) {
        bestArea = area;
        bestMinX = minX;
        bestMaxX = maxX;
        bestMinY = minY;
        bestMaxY = maxY;
      }
    }
  }

  if (bestArea < width * height * 0.003) {
    return null;
  }

  const corners: CalibrationCorners = {
    topLeft: { x: bestMinX, y: bestMinY },
    topRight: { x: bestMaxX, y: bestMinY },
    bottomRight: { x: bestMaxX, y: bestMaxY },
    bottomLeft: { x: bestMinX, y: bestMaxY },
  };

  const { widthPx, heightPx } = averageEdgeLength(corners);
  if (widthPx < 10 || heightPx < 10) {
    return null;
  }
  const ratio = Math.max(widthPx, heightPx) / Math.max(1, Math.min(widthPx, heightPx));
  const a4Ratio = 1.414;
  const cardRatio = 1.586;
  const a4Diff = Math.abs(ratio - a4Ratio);
  const cardDiff = Math.abs(ratio - cardRatio);
  const objectType: CalibrationObjectType = a4Diff <= cardDiff ? 'a4' : 'card';
  const bestDiff = Math.min(a4Diff, cardDiff);
  const confidence = Math.max(0, Math.min(1, 1 - bestDiff / 0.4));

  return {
    objectType,
    corners,
    confidence,
  };
}

export function computePxPerMeter(
  corners: CalibrationCorners,
  objectType: CalibrationObjectType,
): number {
  const { widthPx, heightPx } = averageEdgeLength(corners);
  const longEdgePx = Math.max(widthPx, heightPx);
  const longEdgeMeters = objectType === 'a4' ? 0.297 : 0.0856;
  return longEdgePx / longEdgeMeters;
}

export function computeManualPxPerMeter(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  realDistanceMeters: number,
): number | null {
  if (!Number.isFinite(realDistanceMeters) || realDistanceMeters <= 0) {
    return null;
  }
  const px = distance(pointA, pointB);
  if (px <= 0) return null;
  return px / realDistanceMeters;
}
