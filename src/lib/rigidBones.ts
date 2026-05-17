import type { PoseFrame, PoseLandmark } from './poseEstimation.ts';
import type { BoneStatistics, JointHierarchy } from '../types/session.ts';

export interface BoneSegmentDefinition {
  proximal: number;
  distal: number;
}

export const DEFAULT_BONE_SEGMENTS: Record<string, BoneSegmentDefinition> = {
  left_upper_arm: { proximal: 11, distal: 13 },
  right_upper_arm: { proximal: 12, distal: 14 },
  left_forearm: { proximal: 13, distal: 15 },
  right_forearm: { proximal: 14, distal: 16 },
  left_thigh: { proximal: 23, distal: 25 },
  right_thigh: { proximal: 24, distal: 26 },
  left_shank: { proximal: 25, distal: 27 },
  right_shank: { proximal: 26, distal: 28 },
  left_foot: { proximal: 27, distal: 31 },
  right_foot: { proximal: 28, distal: 32 },
};

export const DEFAULT_JOINT_HIERARCHY: JointHierarchy = {
  11: [13],
  12: [14],
  13: [15],
  14: [16],
  23: [25],
  24: [26],
  25: [27],
  26: [28],
  27: [29, 31],
  28: [30, 32],
};

function cloneLandmark(landmark: PoseLandmark): PoseLandmark {
  return { ...landmark };
}

function cloneFrame(frame: PoseFrame): PoseFrame {
  return {
    ...frame,
    landmarks: frame.landmarks.map(cloneLandmark),
    leftAnkle: cloneLandmark(frame.leftAnkle),
    rightAnkle: cloneLandmark(frame.rightAnkle),
    leftKnee: cloneLandmark(frame.leftKnee),
    rightKnee: cloneLandmark(frame.rightKnee),
    leftHip: cloneLandmark(frame.leftHip),
    rightHip: cloneLandmark(frame.rightHip),
    leftHeel: cloneLandmark(frame.leftHeel),
    rightHeel: cloneLandmark(frame.rightHeel),
    leftFootIndex: cloneLandmark(frame.leftFootIndex),
    rightFootIndex: cloneLandmark(frame.rightFootIndex),
    leftShoulder: cloneLandmark(frame.leftShoulder),
    rightShoulder: cloneLandmark(frame.rightShoulder),
  };
}

function rebuildFrame(frame: PoseFrame): PoseFrame {
  const landmarks = frame.landmarks;
  return {
    ...frame,
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

function isVisible(landmark: PoseLandmark, threshold: number): boolean {
  return (
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y) &&
    Number.isFinite(landmark.z) &&
    Number.isFinite(landmark.visibility) &&
    landmark.visibility >= threshold
  );
}

function norm3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function calculateBoneStatistics(
  frames: PoseFrame[],
  segmentDefinitions: Record<string, BoneSegmentDefinition> = DEFAULT_BONE_SEGMENTS,
  visibilityThreshold = 0.5,
): Record<string, BoneStatistics> {
  const stats: Record<string, BoneStatistics> = {};

  for (const [segmentName, segment] of Object.entries(segmentDefinitions)) {
    const lengths: number[] = [];
    for (const frame of frames) {
      const proximal = frame.landmarks[segment.proximal];
      const distal = frame.landmarks[segment.distal];
      if (!proximal || !distal || !isVisible(proximal, visibilityThreshold) || !isVisible(distal, visibilityThreshold)) {
        continue;
      }
      const length = norm3(distal.x - proximal.x, distal.y - proximal.y, distal.z - proximal.z);
      if (Number.isFinite(length) && length > 0) lengths.push(length);
    }

    if (!lengths.length) {
      stats[segmentName] = { medianLength: 0, stdLength: 0, validFrameCount: 0 };
      continue;
    }

    lengths.sort((a, b) => a - b);
    const mid = Math.floor(lengths.length / 2);
    const medianLength =
      lengths.length % 2 === 0 ? (lengths[mid - 1] + lengths[mid]) / 2 : lengths[mid];
    const mean = lengths.reduce((acc, value) => acc + value, 0) / lengths.length;
    const variance = lengths.reduce((acc, value) => acc + (value - mean) ** 2, 0) / lengths.length;

    stats[segmentName] = {
      medianLength,
      stdLength: Math.sqrt(variance),
      validFrameCount: lengths.length,
    };
  }

  return stats;
}

function applyDeltaToChildren(
  frame: PoseFrame,
  parentIndex: number,
  dx: number,
  dy: number,
  dz: number,
  hierarchy: JointHierarchy,
  visited: Set<number>,
): void {
  const children = hierarchy[parentIndex] ?? [];
  for (const childIndex of children) {
    if (visited.has(childIndex)) continue;
    visited.add(childIndex);

    const child = frame.landmarks[childIndex];
    if (child) {
      child.x += dx;
      child.y += dy;
      child.z += dz;
    }

    applyDeltaToChildren(frame, childIndex, dx, dy, dz, hierarchy, visited);
  }
}

export function enforceRigidBonesOnPoseFrames(
  frames: PoseFrame[],
  options?: {
    segmentDefinitions?: Record<string, BoneSegmentDefinition>;
    hierarchy?: JointHierarchy;
    visibilityThreshold?: number;
    boneStats?: Record<string, BoneStatistics>;
  },
): { frames: PoseFrame[]; boneStats: Record<string, BoneStatistics> } {
  if (!frames.length) return { frames: [], boneStats: {} };

  const segmentDefinitions = options?.segmentDefinitions ?? DEFAULT_BONE_SEGMENTS;
  const hierarchy = options?.hierarchy ?? DEFAULT_JOINT_HIERARCHY;
  const visibilityThreshold = options?.visibilityThreshold ?? 0.5;
  const boneStats =
    options?.boneStats ?? calculateBoneStatistics(frames, segmentDefinitions, visibilityThreshold);

  const updatedFrames = frames.map(cloneFrame);

  for (const frame of updatedFrames) {
    for (const [segmentName, segment] of Object.entries(segmentDefinitions)) {
      const desiredLength = boneStats[segmentName]?.medianLength ?? 0;
      if (!(desiredLength > 0)) continue;

      const proximal = frame.landmarks[segment.proximal];
      const distal = frame.landmarks[segment.distal];
      if (!proximal || !distal || !isVisible(proximal, visibilityThreshold) || !isVisible(distal, visibilityThreshold)) {
        continue;
      }

      const vx = distal.x - proximal.x;
      const vy = distal.y - proximal.y;
      const vz = distal.z - proximal.z;
      const currentLength = norm3(vx, vy, vz);
      if (!(currentLength > 1e-9)) continue;

      const ux = vx / currentLength;
      const uy = vy / currentLength;
      const uz = vz / currentLength;
      const correction = desiredLength - currentLength;
      const dx = ux * correction;
      const dy = uy * correction;
      const dz = uz * correction;

      distal.x += dx;
      distal.y += dy;
      distal.z += dz;

      applyDeltaToChildren(frame, segment.distal, dx, dy, dz, hierarchy, new Set<number>([segment.distal]));
    }
  }

  return { frames: updatedFrames.map(rebuildFrame), boneStats };
}
