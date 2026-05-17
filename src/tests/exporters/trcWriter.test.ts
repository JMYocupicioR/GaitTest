import { describe, expect, it } from 'vitest';
import type { PoseFrame, PoseLandmark } from '../../lib/poseEstimation.ts';
import type { ProcessedSkeleton } from '../../types/session.ts';
import { exportToTRC } from '../../lib/exporters/trcWriter.ts';

function lm(x: number, y: number, z: number, visibility = 0.99): PoseLandmark {
  return { x, y, z, visibility };
}

function makeFrame(timestamp: number, hidden = false): PoseFrame {
  const landmarks = Array.from({ length: 33 }, (_, i) => lm(0.2 + i * 0.001, 0.5, -0.1, hidden ? 0.2 : 0.99));
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

function makeProcessedSkeleton(): ProcessedSkeleton {
  return {
    frames: [makeFrame(0), makeFrame(1 / 30, true)],
    segmentCOM: {},
    totalCOM: [],
    boneStats: {},
    landmarkQualityScores: [],
    frameQualityScores: [],
  };
}

describe('trcWriter', () => {
  it('creates TRC header and expected rows', () => {
    const trc = exportToTRC(makeProcessedSkeleton(), { frameRateHz: 30, fileName: 'test.trc' });
    expect(trc).toContain('PathFileType');
    expect(trc).toContain('NumFrames');
    expect(trc).toContain('test.trc');
  });

  it('exports occluded markers as blank fields', () => {
    const trc = exportToTRC(makeProcessedSkeleton(), { visibilityThreshold: 0.5 });
    const lines = trc.split('\n');
    // The last row should include multiple consecutive tabs from blank marker fields.
    expect(lines[lines.length - 1]).toContain('\t\t\t');
  });

  it('supports Z-up mm export mode for interoperability', () => {
    const trc = exportToTRC(makeProcessedSkeleton(), { coordinateMode: 'zup_mm' });
    const lines = trc.split('\n');
    expect(lines[2]).toContain('\tmm\t');
  });
});
