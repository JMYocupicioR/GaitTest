import { describe, expect, it } from 'vitest';
import type { PoseFrame, PoseLandmark } from '../lib/poseEstimation.ts';
import { calculateBoneStatistics, DEFAULT_BONE_SEGMENTS, enforceRigidBonesOnPoseFrames } from '../lib/rigidBones.ts';

function lm(x: number, y: number, z: number, visibility = 0.99): PoseLandmark {
  return { x, y, z, visibility };
}

function frameWithLeg(kneeToAnkle = 0.14): PoseFrame {
  const landmarks = Array.from({ length: 33 }, () => lm(0.5, 0.5, 0));
  landmarks[23] = lm(0.4, 0.6, -0.1);
  landmarks[25] = lm(0.4, 0.75, -0.14);
  landmarks[27] = lm(0.4, 0.75 + kneeToAnkle, -0.16);
  landmarks[29] = lm(0.4, 0.75 + kneeToAnkle + 0.02, -0.16);
  landmarks[31] = lm(0.42, 0.75 + kneeToAnkle + 0.03, -0.16);
  landmarks[24] = lm(0.6, 0.6, -0.1);
  landmarks[26] = lm(0.6, 0.75, -0.14);
  landmarks[28] = lm(0.6, 0.9, -0.16);
  landmarks[30] = lm(0.6, 0.92, -0.16);
  landmarks[32] = lm(0.62, 0.93, -0.16);
  landmarks[11] = lm(0.42, 0.4, -0.08);
  landmarks[12] = lm(0.58, 0.4, -0.08);
  landmarks[13] = lm(0.38, 0.52, -0.08);
  landmarks[14] = lm(0.62, 0.52, -0.08);
  landmarks[15] = lm(0.36, 0.64, -0.08);
  landmarks[16] = lm(0.64, 0.64, -0.08);

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

describe('rigidBones', () => {
  it('calculates median bone statistics', () => {
    const frames = [frameWithLeg(0.14), frameWithLeg(0.2), frameWithLeg(0.12)];
    const stats = calculateBoneStatistics(frames, DEFAULT_BONE_SEGMENTS, 0.5);
    expect(stats.left_shank.validFrameCount).toBe(3);
    expect(stats.left_shank.medianLength).toBeGreaterThan(0);
  });

  it('enforces target segment length', () => {
    const frames = [frameWithLeg(0.14), frameWithLeg(0.22), frameWithLeg(0.1)];
    const baseline = calculateBoneStatistics(frames, DEFAULT_BONE_SEGMENTS, 0.5);
    const { frames: rigidFrames } = enforceRigidBonesOnPoseFrames(frames, {
      segmentDefinitions: DEFAULT_BONE_SEGMENTS,
      boneStats: baseline,
      visibilityThreshold: 0.5,
    });

    const post = calculateBoneStatistics(rigidFrames, DEFAULT_BONE_SEGMENTS, 0.5);
    expect(post.left_shank.stdLength).toBeLessThanOrEqual(baseline.left_shank.stdLength);
  });
});
