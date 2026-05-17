import type { GaitEvent, SessionData } from '../types/session.ts';
import type { PoseFrame, PoseLandmark } from './poseEstimation.ts';

type CompactJointKey =
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle'
  | 'leftHeel'
  | 'rightHeel';

export interface CompactKeyFrameRecord {
  eventType: GaitEvent['type'];
  foot: GaitEvent['foot'];
  timestampSec: number;
  landmarkSnapshot: Record<CompactJointKey, [number, number, number, number]>;
}

export interface KinematicSeriesRecord {
  joint: 'hip_flex' | 'knee_flex' | 'ankle_flex';
  side: 'L' | 'R';
  percentCycle: number[];
}

const round = (value: number) => Number(value.toFixed(3));

const compactLandmark = (landmark: PoseLandmark): [number, number, number, number] => [
  round(landmark.x),
  round(landmark.y),
  round(landmark.z),
  round(landmark.visibility),
];

const pickClosestFrame = (frames: PoseFrame[], timestamp: number): PoseFrame | null => {
  if (!frames.length) {
    return null;
  }

  let bestFrame = frames[0];
  let bestDelta = Math.abs(frames[0].timestamp - timestamp);
  for (let i = 1; i < frames.length; i += 1) {
    const current = frames[i];
    const currentDelta = Math.abs(current.timestamp - timestamp);
    if (currentDelta < bestDelta) {
      bestDelta = currentDelta;
      bestFrame = current;
    }
  }
  return bestFrame;
};

const sanitizeForPersistence = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item instanceof Blob) {
        return undefined;
      }
      return item;
    }),
  ) as T;

export const buildPersistedSessionData = (session: SessionData) => {
  const sessionBase = { ...session };
  delete sessionBase.videoBlob;
  delete sessionBase.poseFrames;
  const sanitizedEnhanced = session.enhancedAnalysisResult
    ? {
        ...session.enhancedAnalysisResult,
        detailedKinematics: undefined,
      }
    : undefined;

  return sanitizeForPersistence({
    ...sessionBase,
    enhancedAnalysisResult: sanitizedEnhanced,
  });
};

export const extractCompactKeyFrames = (
  poseFrames: PoseFrame[],
  events: GaitEvent[],
  maxFrames = 12,
): CompactKeyFrameRecord[] => {
  if (!poseFrames.length || !events.length) {
    return [];
  }

  return [...events]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, maxFrames)
    .map((event) => {
      const frame = pickClosestFrame(poseFrames, event.timestamp);
      if (!frame) {
        return null;
      }

      return {
        eventType: event.type,
        foot: event.foot,
        timestampSec: round(event.timestamp),
        landmarkSnapshot: {
          leftHip: compactLandmark(frame.leftHip),
          rightHip: compactLandmark(frame.rightHip),
          leftKnee: compactLandmark(frame.leftKnee),
          rightKnee: compactLandmark(frame.rightKnee),
          leftAnkle: compactLandmark(frame.leftAnkle),
          rightAnkle: compactLandmark(frame.rightAnkle),
          leftHeel: compactLandmark(frame.leftHeel),
          rightHeel: compactLandmark(frame.rightHeel),
        },
      };
    })
    .filter((item): item is CompactKeyFrameRecord => item != null);
};

export const extractKinematicSeriesData = (session: SessionData): KinematicSeriesRecord[] => {
  const kinData = session.enhancedAnalysisResult?.kinematicSummary?.kinematicData;
  if (!kinData) {
    return [];
  }

  const entries: Array<{
    joint: KinematicSeriesRecord['joint'];
    left?: number[] | null;
    right?: number[] | null;
  }> = [
    {
      joint: 'hip_flex',
      left: kinData.sagittal?.hipFlexion?.left?.summary?.normalizedCycles?.mean101,
      right: kinData.sagittal?.hipFlexion?.right?.summary?.normalizedCycles?.mean101,
    },
    {
      joint: 'knee_flex',
      left: kinData.sagittal?.kneeFlexion?.left?.summary?.normalizedCycles?.mean101,
      right: kinData.sagittal?.kneeFlexion?.right?.summary?.normalizedCycles?.mean101,
    },
    {
      joint: 'ankle_flex',
      left: kinData.sagittal?.ankleFlexion?.left?.summary?.normalizedCycles?.mean101,
      right: kinData.sagittal?.ankleFlexion?.right?.summary?.normalizedCycles?.mean101,
    },
  ];

  return entries.flatMap((entry) => {
    const out: KinematicSeriesRecord[] = [];
    if (entry.left?.length) {
      out.push({
        joint: entry.joint,
        side: 'L',
        percentCycle: entry.left.map((value) => round(value)),
      });
    }
    if (entry.right?.length) {
      out.push({
        joint: entry.joint,
        side: 'R',
        percentCycle: entry.right.map((value) => round(value)),
      });
    }
    return out;
  });
};
