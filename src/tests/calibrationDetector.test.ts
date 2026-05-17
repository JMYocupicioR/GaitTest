import { describe, expect, it } from 'vitest';
import {
  computeManualPxPerMeter,
  computePxPerMeter,
  detectCalibrationObjectFromImageData,
} from '../lib/calibrationDetector.ts';

describe('calibrationDetector', () => {
  it('computes px/m from manual point pair', () => {
    const pxPerMeter = computeManualPxPerMeter({ x: 10, y: 10 }, { x: 210, y: 10 }, 1);
    expect(pxPerMeter).toBeCloseTo(200, 4);
  });

  it('detects a synthetic dark rectangle and computes object scale', () => {
    const w = 200;
    const h = 140;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
      data[i * 4] = 245;
      data[i * 4 + 1] = 245;
      data[i * 4 + 2] = 245;
      data[i * 4 + 3] = 255;
    }
    for (let y = 40; y < 110; y += 1) {
      for (let x = 60; x < 150; x += 1) {
        const idx = (y * w + x) * 4;
        data[idx] = 25;
        data[idx + 1] = 25;
        data[idx + 2] = 25;
      }
    }
    const img = { data, width: w, height: h } as ImageData;
    const detected = detectCalibrationObjectFromImageData(img);
    expect(detected).not.toBeNull();
    if (!detected) return;
    const pxm = computePxPerMeter(detected.corners, detected.objectType);
    expect(pxm).toBeGreaterThan(50);
  });
});
