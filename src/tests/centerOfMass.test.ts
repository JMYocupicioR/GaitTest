import { describe, expect, it } from 'vitest';
import type { PoseFrame, PoseLandmark } from '../lib/poseEstimation.ts';
import { computeCenterOfMassFromPoseFrames } from '../lib/centerOfMass.ts';

function landmark(x: number, y: number, z: number, visibility = 0.99): PoseLandmark {
  return { x, y, z, visibility };
}

function makeFrame(offset = 0): PoseFrame {
  const landmarks = Array.from({ length: 33 }, (_, i) => landmark(offset + i * 0.001, 0.5, -0.2));
  landmarks[11] = landmark(offset + 0.3, 0.35, -0.1);
  landmarks[12] = landmark(offset + 0.5, 0.35, -0.1);
  landmarks[23] = landmark(offset + 0.32, 0.6, -0.12);
  landmarks[24] = landmark(offset + 0.48, 0.6, -0.12);
  landmarks[25] = landmark(offset + 0.32, 0.78, -0.14);
  landmarks[26] = landmark(offset + 0.48, 0.78, -0.14);
  landmarks[27] = landmark(offset + 0.32, 0.93, -0.18);
  landmarks[28] = landmark(offset + 0.48, 0.93, -0.18);
  landmarks[31] = landmark(offset + 0.34, 0.98, -0.18);
  landmarks[32] = landmark(offset + 0.46, 0.98, -0.18);
  landmarks[13] = landmark(offset + 0.26, 0.47, -0.08);
  landmarks[14] = landmark(offset + 0.54, 0.47, -0.08);
  landmarks[15] = landmark(offset + 0.2, 0.6, -0.08);
  landmarks[16] = landmark(offset + 0.6, 0.6, -0.08);
  landmarks[0] = landmark(offset + 0.4, 0.2, -0.05);

  return {
    timestamp: 0,
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

describe('computeCenterOfMassFromPoseFrames', () => {
  it('returns total COM for each frame', () => {
    const frames = [makeFrame(0), makeFrame(0.02), makeFrame(0.04)];
    const result = computeCenterOfMassFromPoseFrames(frames);

    expect(result.totalCOM).toHaveLength(3);
    expect(result.totalCOM[0]).not.toBeNull();
    expect(Object.keys(result.segmentCOM).length).toBeGreaterThan(5);
  });

  it('gracefully handles missing visibility', () => {
    const frames = [makeFrame(0)];
    frames[0].landmarks[23].visibility = 0.1;
    frames[0].landmarks[24].visibility = 0.1;

    const result = computeCenterOfMassFromPoseFrames(frames, undefined, 0.5);
    // Some upper body segments still valid, total COM may still exist due normalization.
    expect(result.totalCOM.length).toBe(1);
  });
});
