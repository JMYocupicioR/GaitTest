import { describe, expect, it } from 'vitest';
import type { PoseFrame, PoseLandmark } from '../lib/poseEstimation.ts';
import {
  computeDerivedBiometrics,
  deriveScaleFromHeight,
  estimateHeightFromPose,
} from '../lib/biometricCalibration.ts';

function lm(x: number, y: number, z = 0, visibility = 0.99): PoseLandmark {
  return { x, y, z, visibility };
}

function makeFrame(timestamp: number, yNoise = 0): PoseFrame {
  const landmarks = Array.from({ length: 33 }, (_, index) => lm(0.2 + index * 0.01, 0.5, 0));
  landmarks[0] = lm(0.5, 0.1 + yNoise, 0); // nose
  landmarks[11] = lm(0.42, 0.3 + yNoise, 0);
  landmarks[12] = lm(0.58, 0.3 + yNoise, 0);
  landmarks[23] = lm(0.45, 0.55 + yNoise, 0);
  landmarks[24] = lm(0.55, 0.55 + yNoise, 0);
  landmarks[25] = lm(0.45, 0.72 + yNoise, 0);
  landmarks[26] = lm(0.55, 0.72 + yNoise, 0);
  landmarks[27] = lm(0.45, 0.9 + yNoise, 0);
  landmarks[28] = lm(0.55, 0.9 + yNoise, 0);
  landmarks[29] = lm(0.45, 0.93 + yNoise, 0);
  landmarks[30] = lm(0.55, 0.93 + yNoise, 0);
  landmarks[31] = lm(0.47, 0.95 + yNoise, 0);
  landmarks[32] = lm(0.53, 0.95 + yNoise, 0);

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

describe('biometricCalibration', () => {
  const frames = [
    makeFrame(0, 0),
    makeFrame(0.033, 0.003),
    makeFrame(0.066, -0.002),
    makeFrame(0.099, 0.002),
    makeFrame(0.132, -0.001),
    makeFrame(0.165, 0.001),
    makeFrame(0.198, -0.002),
    makeFrame(0.231, 0.002),
  ];

  it('derives a calibrated scale from known height', () => {
    const result = deriveScaleFromHeight(frames, 170, {
      frameWidthPx: 1000,
      frameHeightPx: 500,
    });

    expect(result).not.toBeNull();
    expect(result?.frameGroundWidthMeters).toBeCloseTo(3.91, 2);
    expect(result?.pxPerMeter).toBeCloseTo(255.75, 2);
    expect(result?.confidence).toBeGreaterThan(0);
  });

  it('estimates height from pose when scale is available', () => {
    const estimated = estimateHeightFromPose(frames, {
      frameWidthPx: 1000,
      frameHeightPx: 500,
      frameGroundWidthMeters: 3.91,
    });

    expect(estimated).not.toBeNull();
    expect(estimated?.heightCm).toBeCloseTo(170, 0);
  });

  it('returns null estimate when no camera scale is available', () => {
    expect(estimateHeightFromPose(frames)).toBeNull();
  });

  it('computes derived biometrics including BMI and segment masses', () => {
    const biometrics = computeDerivedBiometrics({
      effectiveHeightCm: 170,
      heightSource: 'manual',
      weightKg: 70,
      frameGroundWidthMeters: 3.91,
      pxPerMeter: 255.75,
    });

    expect(biometrics.legLengthCm).toBeCloseTo(90.1, 2);
    expect(biometrics.bmi).toBeCloseTo(24.2215, 4);
    expect(biometrics.segmentMassesKg).not.toBeNull();
    expect(biometrics.segmentMassesKg?.trunk).toBeCloseTo(34.79, 2);
  });
});
