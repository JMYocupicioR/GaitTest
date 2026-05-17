import type { PoseFrame, PoseLandmark } from './poseEstimation.ts';
import type { SegmentInfo, SkeletonPoint3D } from '../types/session.ts';
import { MEDIAPIPE_SEGMENTS_WINTER } from '../types/session.ts';

function isVisible(landmark: PoseLandmark, threshold: number): boolean {
  return (
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y) &&
    Number.isFinite(landmark.z) &&
    Number.isFinite(landmark.visibility) &&
    landmark.visibility >= threshold
  );
}

function resolveEndpoint(
  landmarks: PoseLandmark[],
  endpoint: SegmentInfo['proximal'],
  visibilityThreshold: number,
): SkeletonPoint3D | null {
  if (Array.isArray(endpoint)) {
    const a = landmarks[endpoint[0]];
    const b = landmarks[endpoint[1]];
    if (!a || !b || !isVisible(a, visibilityThreshold) || !isVisible(b, visibilityThreshold)) return null;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
      visibility: Math.min(a.visibility, b.visibility),
    };
  }

  const landmark = landmarks[endpoint];
  if (!landmark || !isVisible(landmark, visibilityThreshold)) return null;
  return { x: landmark.x, y: landmark.y, z: landmark.z, visibility: landmark.visibility };
}

export function computeSegmentCOM(
  proximal: SkeletonPoint3D,
  distal: SkeletonPoint3D,
  segment: SegmentInfo,
): SkeletonPoint3D {
  const t = segment.comLength;
  return {
    x: proximal.x + (distal.x - proximal.x) * t,
    y: proximal.y + (distal.y - proximal.y) * t,
    z: proximal.z + (distal.z - proximal.z) * t,
    visibility: Math.min(proximal.visibility ?? 1, distal.visibility ?? 1),
  };
}

function combineWeightedCOM(segments: Array<{ com: SkeletonPoint3D; mass: number }>): SkeletonPoint3D | null {
  const totalMass = segments.reduce((acc, segment) => acc + segment.mass, 0);
  if (totalMass <= 0) return null;

  const weighted = segments.reduce(
    (acc, segment) => ({
      x: acc.x + segment.com.x * (segment.mass / totalMass),
      y: acc.y + segment.com.y * (segment.mass / totalMass),
      z: acc.z + segment.com.z * (segment.mass / totalMass),
    }),
    { x: 0, y: 0, z: 0 },
  );

  return { ...weighted, visibility: 1 };
}

export function computeCenterOfMassFromPoseFrames(
  frames: PoseFrame[],
  segmentDefinitions: SegmentInfo[] = MEDIAPIPE_SEGMENTS_WINTER,
  visibilityThreshold = 0.5,
): {
  segmentCOM: Record<string, Array<SkeletonPoint3D | null>>;
  totalCOM: Array<SkeletonPoint3D | null>;
} {
  const segmentCOM: Record<string, Array<SkeletonPoint3D | null>> = {};
  for (const segment of segmentDefinitions) segmentCOM[segment.name] = [];

  const totalCOM: Array<SkeletonPoint3D | null> = [];

  for (const frame of frames) {
    const validSegments: Array<{ com: SkeletonPoint3D; mass: number }> = [];

    for (const segment of segmentDefinitions) {
      const proximal = resolveEndpoint(frame.landmarks, segment.proximal, visibilityThreshold);
      const distal = resolveEndpoint(frame.landmarks, segment.distal, visibilityThreshold);

      if (!proximal || !distal) {
        segmentCOM[segment.name].push(null);
        continue;
      }

      const com = computeSegmentCOM(proximal, distal, segment);
      segmentCOM[segment.name].push(com);
      validSegments.push({ com, mass: segment.massPercentage });
    }

    const total = combineWeightedCOM(validSegments);
    if (!total) {
      totalCOM.push(null);
      continue;
    }
    totalCOM.push(total);
  }

  return { segmentCOM, totalCOM };
}

export function computeWeightedCenterOfMass(
  segmentComByName: Record<string, SkeletonPoint3D | null>,
  segmentMassesKg: Record<string, number>,
): SkeletonPoint3D | null {
  const weightedSegments: Array<{ com: SkeletonPoint3D; mass: number }> = [];

  for (const [segmentName, com] of Object.entries(segmentComByName)) {
    if (!com) continue;
    const mass = segmentMassesKg[segmentName];
    if (!(Number.isFinite(mass) && mass > 0)) continue;
    weightedSegments.push({ com, mass });
  }

  return combineWeightedCOM(weightedSegments);
}

export function calculateCenterOfMassVariabilityFromSeries(
  totalCOM: Array<SkeletonPoint3D | null>,
): number | null {
  const valid = totalCOM.filter((value): value is SkeletonPoint3D => value !== null);
  if (valid.length < 5) return null;

  const xs = valid.map((v) => v.x);
  const ys = valid.map((v) => v.y);

  const variability = (values: number[]) => {
    const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
    return (Math.sqrt(variance) / Math.abs(mean)) * 100;
  };

  const xVar = variability(xs);
  const yVar = variability(ys);
  return Math.sqrt(xVar * xVar + yVar * yVar);
}
