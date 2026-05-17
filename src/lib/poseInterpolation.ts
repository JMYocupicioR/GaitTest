import type { PoseFrame, PoseLandmark } from './poseEstimation.ts';

export interface PoseInterpolationOptions {
  visibilityThreshold?: number;
  maxGapFrames?: number;
}

const DEFAULT_VISIBILITY_THRESHOLD = 0.5;
const DEFAULT_MAX_GAP_FRAMES = 6;

function cloneFrame(frame: PoseFrame): PoseFrame {
  return {
    ...frame,
    landmarks: frame.landmarks.map((landmark) => ({ ...landmark })),
    leftAnkle: { ...frame.leftAnkle },
    rightAnkle: { ...frame.rightAnkle },
    leftKnee: { ...frame.leftKnee },
    rightKnee: { ...frame.rightKnee },
    leftHip: { ...frame.leftHip },
    rightHip: { ...frame.rightHip },
    leftHeel: { ...frame.leftHeel },
    rightHeel: { ...frame.rightHeel },
    leftFootIndex: { ...frame.leftFootIndex },
    rightFootIndex: { ...frame.rightFootIndex },
    leftShoulder: { ...frame.leftShoulder },
    rightShoulder: { ...frame.rightShoulder },
  };
}

function isFiniteLandmark(landmark: PoseLandmark): boolean {
  return (
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y) &&
    Number.isFinite(landmark.z) &&
    Number.isFinite(landmark.visibility)
  );
}

function rebuildFrameWithLandmarks(frame: PoseFrame, landmarks: PoseLandmark[]): PoseFrame {
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

function cubicHermite(p0: number, p1: number, m0: number, m1: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * m0 +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * m1
  );
}

function sampleTangent(
  values: number[],
  validIndices: number[],
  validPosition: number,
  currentIndex: number,
  fallback: number,
): number {
  const prevValidIndex = validPosition > 0 ? validIndices[validPosition - 1] : currentIndex;
  const nextValidIndex =
    validPosition < validIndices.length - 1 ? validIndices[validPosition + 1] : currentIndex;

  const prevValue = prevValidIndex === currentIndex ? fallback : values[prevValidIndex];
  const nextValue = nextValidIndex === currentIndex ? fallback : values[nextValidIndex];
  return (nextValue - prevValue) / 2;
}

/**
 * Rellena gaps cortos de landmarks con interpolacion cubica.
 * Los gaps largos (> maxGapFrames) se conservan sin cambios.
 */
export function interpolatePoseFrames(
  frames: PoseFrame[],
  options: PoseInterpolationOptions = {},
): PoseFrame[] {
  if (frames.length < 3) return frames.map(cloneFrame);

  const visibilityThreshold = options.visibilityThreshold ?? DEFAULT_VISIBILITY_THRESHOLD;
  const maxGapFrames = options.maxGapFrames ?? DEFAULT_MAX_GAP_FRAMES;
  const clonedFrames = frames.map(cloneFrame);
  const landmarkCount = clonedFrames[0]?.landmarks.length ?? 0;

  for (let landmarkIndex = 0; landmarkIndex < landmarkCount; landmarkIndex += 1) {
    const xValues = clonedFrames.map((frame) => frame.landmarks[landmarkIndex]?.x ?? 0);
    const yValues = clonedFrames.map((frame) => frame.landmarks[landmarkIndex]?.y ?? 0);
    const zValues = clonedFrames.map((frame) => frame.landmarks[landmarkIndex]?.z ?? 0);
    const visibilityValues = clonedFrames.map((frame) => frame.landmarks[landmarkIndex]?.visibility ?? 0);

    const validIndices = clonedFrames
      .map((frame, frameIndex) => ({ frameIndex, landmark: frame.landmarks[landmarkIndex] }))
      .filter(({ landmark }) => isFiniteLandmark(landmark) && landmark.visibility >= visibilityThreshold)
      .map(({ frameIndex }) => frameIndex);

    if (validIndices.length < 2) continue;

    for (let v = 0; v < validIndices.length - 1; v += 1) {
      const startIdx = validIndices[v];
      const endIdx = validIndices[v + 1];
      const gapSize = endIdx - startIdx - 1;

      if (gapSize <= 0 || gapSize > maxGapFrames) continue;

      const startX = xValues[startIdx];
      const endX = xValues[endIdx];
      const startY = yValues[startIdx];
      const endY = yValues[endIdx];
      const startZ = zValues[startIdx];
      const endZ = zValues[endIdx];

      const tangentX0 = sampleTangent(xValues, validIndices, v, startIdx, startX);
      const tangentX1 = sampleTangent(xValues, validIndices, v + 1, endIdx, endX);
      const tangentY0 = sampleTangent(yValues, validIndices, v, startIdx, startY);
      const tangentY1 = sampleTangent(yValues, validIndices, v + 1, endIdx, endY);
      const tangentZ0 = sampleTangent(zValues, validIndices, v, startIdx, startZ);
      const tangentZ1 = sampleTangent(zValues, validIndices, v + 1, endIdx, endZ);

      for (let i = startIdx + 1; i < endIdx; i += 1) {
        const t = (i - startIdx) / (endIdx - startIdx);
        const landmark = clonedFrames[i].landmarks[landmarkIndex];
        landmark.x = cubicHermite(startX, endX, tangentX0, tangentX1, t);
        landmark.y = cubicHermite(startY, endY, tangentY0, tangentY1, t);
        landmark.z = cubicHermite(startZ, endZ, tangentZ0, tangentZ1, t);
        landmark.visibility = Math.max(
          visibilityThreshold,
          visibilityValues[startIdx] * (1 - t) + visibilityValues[endIdx] * t,
        );
      }
    }
  }

  return clonedFrames.map((frame) => rebuildFrameWithLandmarks(frame, frame.landmarks));
}
