import type { PoseFrame } from './poseEstimation.ts';
import type { JointHierarchy, ProcessedSkeleton, SegmentInfo } from '../types/session.ts';
import { MEDIAPIPE_SEGMENTS_WINTER } from '../types/session.ts';
import { applyLandmarkFiltering } from './signalProcessing.ts';
import { interpolatePoseFrames } from './poseInterpolation.ts';
import {
  calculateBoneStatistics,
  DEFAULT_BONE_SEGMENTS,
  DEFAULT_JOINT_HIERARCHY,
  enforceRigidBonesOnPoseFrames,
  type BoneSegmentDefinition,
} from './rigidBones.ts';
import { computeCenterOfMassFromPoseFrames } from './centerOfMass.ts';

export interface PostProcessPoseOptions {
  interpolationVisibilityThreshold?: number;
  interpolationMaxGapFrames?: number;
  filterCutoffHz?: number;
  sampleRateHz?: number;
  enforceRigidBones?: boolean;
  rigidBoneVisibilityThreshold?: number;
  segmentDefinitions?: Record<string, BoneSegmentDefinition>;
  segmentCOMDefinitions?: SegmentInfo[];
  jointHierarchy?: JointHierarchy;
}

function calculateQualityScores(frames: PoseFrame[]): {
  landmarkQualityScores: number[][];
  frameQualityScores: number[];
} {
  const landmarkQualityScores: number[][] = [];
  const frameQualityScores: number[] = [];

  for (const frame of frames) {
    const landmarkScores = frame.landmarks.map((landmark) =>
      Number.isFinite(landmark.visibility) ? Math.max(0, Math.min(1, landmark.visibility)) : 0,
    );
    landmarkQualityScores.push(landmarkScores);
    const frameScore =
      landmarkScores.reduce((acc, score) => acc + score, 0) / Math.max(1, landmarkScores.length);
    frameQualityScores.push(frameScore);
  }

  return { landmarkQualityScores, frameQualityScores };
}

/**
 * Pipeline de post-procesamiento inspirado en FreeMoCap:
 * interpolacion -> filtrado -> rigid bones -> COM.
 */
export function postProcessPoseFrames(
  rawFrames: PoseFrame[],
  options: PostProcessPoseOptions = {},
): ProcessedSkeleton {
  if (!rawFrames.length) {
    return {
      frames: [],
      segmentCOM: {},
      totalCOM: [],
      boneStats: {},
      landmarkQualityScores: [],
      frameQualityScores: [],
    };
  }

  const interpolationVisibilityThreshold = options.interpolationVisibilityThreshold ?? 0.5;
  const interpolationMaxGapFrames = options.interpolationMaxGapFrames ?? 6;
  const filterCutoffHz = options.filterCutoffHz ?? 6;
  const sampleRateHz = options.sampleRateHz ?? 30;
  const rigidBoneVisibilityThreshold = options.rigidBoneVisibilityThreshold ?? 0.5;
  const segmentDefinitions = options.segmentDefinitions ?? DEFAULT_BONE_SEGMENTS;
  const segmentCOMDefinitions = options.segmentCOMDefinitions ?? MEDIAPIPE_SEGMENTS_WINTER;
  const jointHierarchy = options.jointHierarchy ?? DEFAULT_JOINT_HIERARCHY;

  const interpolated = interpolatePoseFrames(rawFrames, {
    visibilityThreshold: interpolationVisibilityThreshold,
    maxGapFrames: interpolationMaxGapFrames,
  });
  const filtered = applyLandmarkFiltering(interpolated, filterCutoffHz, sampleRateHz);

  const baseBoneStats = calculateBoneStatistics(
    filtered,
    segmentDefinitions,
    rigidBoneVisibilityThreshold,
  );

  const rigidResult =
    options.enforceRigidBones === false
      ? { frames: filtered, boneStats: baseBoneStats }
      : enforceRigidBonesOnPoseFrames(filtered, {
          segmentDefinitions,
          hierarchy: jointHierarchy,
          visibilityThreshold: rigidBoneVisibilityThreshold,
          boneStats: baseBoneStats,
        });

  const comData = computeCenterOfMassFromPoseFrames(
    rigidResult.frames,
    segmentCOMDefinitions,
    interpolationVisibilityThreshold,
  );

  const qualityScores = calculateQualityScores(rigidResult.frames);

  return {
    frames: rigidResult.frames,
    segmentCOM: comData.segmentCOM,
    totalCOM: comData.totalCOM,
    boneStats: rigidResult.boneStats,
    landmarkQualityScores: qualityScores.landmarkQualityScores,
    frameQualityScores: qualityScores.frameQualityScores,
  };
}
