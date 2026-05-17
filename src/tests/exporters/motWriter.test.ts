import { describe, expect, it } from 'vitest';
import type { PoseFrame, PoseLandmark } from '../../lib/poseEstimation.ts';
import type { ProcessedSkeleton } from '../../types/session.ts';
import { exportToMOT, type ForceSampleC3D } from '../../lib/exporters/motWriter.ts';

function lm(x: number, y: number, z: number, visibility = 0.99): PoseLandmark {
  return { x, y, z, visibility };
}

function makeFrame(timestamp: number): PoseFrame {
  const landmarks = Array.from({ length: 33 }, (_, i) => lm(0.2 + i * 0.001, 0.5, -0.1));
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

function skeleton(): ProcessedSkeleton {
  return {
    frames: [makeFrame(0), makeFrame(1 / 30)],
    segmentCOM: {},
    totalCOM: [],
    boneStats: {},
    landmarkQualityScores: [],
    frameQualityScores: [],
  };
}

describe('motWriter', () => {
  it('writes valid MOT header', () => {
    const mot = exportToMOT(skeleton());
    expect(mot).toContain('nColumns=10');
    expect(mot).toContain('ground_force_vx');
    expect(mot).toContain('grf_source=placeholder_zero');
  });

  it('zeros force and moments when vertical force is below threshold', () => {
    const forceSamples: ForceSampleC3D[] = [
      { fx: 50, fy: 2, fz: 5, copx: 0.1, copy: 0.2, copz: 0.3, mx: 1, my: 2, mz: 3 },
      { fx: 50, fy: 2, fz: 20, copx: 0.1, copy: 0.2, copz: 0.3, mx: 1, my: 2, mz: 3 },
    ];
    const mot = exportToMOT(skeleton(), [], forceSamples, { verticalThresholdN: 10 });
    const lines = mot.split('\n');
    const dataStart = lines.findIndex((line) => line.startsWith('time\t'));
    const firstData = lines[dataStart + 1];
    expect(firstData).toContain('\t0.000000\t0.000000\t0.000000\t');
  });
});
