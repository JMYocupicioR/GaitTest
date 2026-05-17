import { describe, expect, it } from 'vitest';
import type { PoseFrame, PoseLandmark } from '../lib/poseEstimation.ts';
import { interpolatePoseFrames } from '../lib/poseInterpolation.ts';

function makeLandmark(x: number, y: number, z: number, visibility = 0.99): PoseLandmark {
  return { x, y, z, visibility };
}

function makeFrame(timestamp: number, xOffset: number, hipVisibility = 0.99): PoseFrame {
  const landmarks = Array.from({ length: 33 }, (_, index) => makeLandmark(xOffset + index * 0.001, 0.5, -0.1));
  landmarks[23] = makeLandmark(xOffset + 0.2, 0.6, -0.1, hipVisibility);
  landmarks[24] = makeLandmark(xOffset + 0.4, 0.6, -0.1, hipVisibility);
  landmarks[25] = makeLandmark(xOffset + 0.2, 0.75, -0.12, hipVisibility);
  landmarks[26] = makeLandmark(xOffset + 0.4, 0.75, -0.12, hipVisibility);
  landmarks[27] = makeLandmark(xOffset + 0.2, 0.9, -0.14, hipVisibility);
  landmarks[28] = makeLandmark(xOffset + 0.4, 0.9, -0.14, hipVisibility);
  landmarks[29] = makeLandmark(xOffset + 0.2, 0.92, -0.14, hipVisibility);
  landmarks[30] = makeLandmark(xOffset + 0.4, 0.92, -0.14, hipVisibility);
  landmarks[31] = makeLandmark(xOffset + 0.22, 0.95, -0.14, hipVisibility);
  landmarks[32] = makeLandmark(xOffset + 0.42, 0.95, -0.14, hipVisibility);
  landmarks[11] = makeLandmark(xOffset + 0.24, 0.4, -0.08, hipVisibility);
  landmarks[12] = makeLandmark(xOffset + 0.36, 0.4, -0.08, hipVisibility);

  return {
    timestamp,
    landmarks,
    leftAnkle: landmarks[27],
    rightAnkle: landmarks[28],
    leftKnee: landmarks[25],
    rightKnee: landmarks[26],
    leftHip: landmarks[23],
    rightHip: landmarks[24],
    leftHeel: landmarks[29],
    rightHeel: landmarks[30],
    leftFootIndex: landmarks[31],
    rightFootIndex: landmarks[32],
    leftShoulder: landmarks[11],
    rightShoulder: landmarks[12],
  };
}

describe('interpolatePoseFrames', () => {
  it('fills short gaps when visibility is low', () => {
    const frames = [
      makeFrame(0, 0),
      makeFrame(0.033, 0.01, 0.1), // gap frame
      makeFrame(0.066, 0.02),
    ];

    const interpolated = interpolatePoseFrames(frames, { visibilityThreshold: 0.5, maxGapFrames: 6 });
    expect(interpolated[1].leftHip.visibility).toBeGreaterThanOrEqual(0.5);
    expect(interpolated[1].leftHip.x).toBeGreaterThan(interpolated[0].leftHip.x);
    expect(interpolated[1].leftHip.x).toBeLessThan(interpolated[2].leftHip.x);
  });

  it('keeps long gaps untouched', () => {
    const frames = Array.from({ length: 10 }, (_, i) => makeFrame(i * 0.033, i * 0.01, i >= 1 && i <= 8 ? 0.1 : 0.99));
    const interpolated = interpolatePoseFrames(frames, { visibilityThreshold: 0.5, maxGapFrames: 3 });
    expect(interpolated[4].leftHip.visibility).toBe(0.1);
  });
});
