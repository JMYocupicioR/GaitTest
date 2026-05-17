import { describe, expect, it } from 'vitest';
import { AdvancedEventDetector } from '../lib/advancedEventDetection.ts';
import type { PoseFrame } from '../lib/poseEstimation.ts';

function frameAt(timestamp: number, leftY: number, rightY: number): PoseFrame {
  const mk = (x: number, y: number) => ({ x, y, z: 0, visibility: 0.95 });
  const landmarks = Array.from({ length: 33 }, () => mk(0.5, 0.5));
  landmarks[27] = mk(0.4, leftY);
  landmarks[28] = mk(0.6, rightY);
  landmarks[25] = mk(0.4, 0.45);
  landmarks[26] = mk(0.6, 0.45);
  landmarks[23] = mk(0.42, 0.4);
  landmarks[24] = mk(0.58, 0.4);
  landmarks[29] = mk(0.4, leftY + 0.01);
  landmarks[30] = mk(0.6, rightY + 0.01);
  landmarks[31] = mk(0.4, leftY + 0.02);
  landmarks[32] = mk(0.6, rightY + 0.02);
  landmarks[11] = mk(0.42, 0.3);
  landmarks[12] = mk(0.58, 0.3);
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

describe('AdvancedEventDetector', () => {
  it('detects at least one event from synthetic gait sequence', () => {
    const detector = new AdvancedEventDetector();
    const events: string[] = [];
    detector.setEventCallback((event) => events.push(`${event.type}-${event.foot}`));

    const seq = [
      frameAt(0.00, 0.70, 0.66),
      frameAt(0.05, 0.69, 0.65),
      frameAt(0.10, 0.69, 0.64),
      frameAt(0.15, 0.68, 0.63),
      frameAt(0.20, 0.68, 0.62),
      frameAt(0.25, 0.67, 0.61),
      frameAt(0.30, 0.66, 0.60),
      frameAt(0.35, 0.65, 0.60),
    ];
    seq.forEach((f) => detector.processFrame(f));

    expect(events.length).toBeGreaterThan(0);
  });
});
