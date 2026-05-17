/**
 * Clinical pose renderer for gait analysis.
 *
 * Draws the 33 MediaPipe Pose landmarks over a video frame using a
 * gait-focused color scheme: left side red, right side blue, midline green,
 * face violet. Key joints (hips, knees, ankles, heels, foot index) are
 * highlighted with larger circles to help the clinician visually verify
 * heel strike / toe off events.
 */

import type { PoseFrame, PoseLandmark } from './poseEstimation.ts';

export const CLINICAL_COLORS = {
  left: '#ef4444',
  right: '#3b82f6',
  midline: '#10b981',
  face: '#a78bfa',
  highlightStroke: '#ffffff',
} as const;

/**
 * MediaPipe Pose landmark indices.
 * Reference: https://google.github.io/mediapipe/solutions/pose
 */
export const POSE_IDX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

type Connection = readonly [number, number];

/**
 * Skeleton connections grouped by anatomical region so each group can be
 * drawn with its clinical color.
 */
export const CLINICAL_CONNECTIONS: Record<
  'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'torso' | 'face',
  readonly Connection[]
> = {
  leftArm: [
    [POSE_IDX.LEFT_SHOULDER, POSE_IDX.LEFT_ELBOW],
    [POSE_IDX.LEFT_ELBOW, POSE_IDX.LEFT_WRIST],
    [POSE_IDX.LEFT_WRIST, POSE_IDX.LEFT_PINKY],
    [POSE_IDX.LEFT_WRIST, POSE_IDX.LEFT_INDEX],
    [POSE_IDX.LEFT_WRIST, POSE_IDX.LEFT_THUMB],
    [POSE_IDX.LEFT_PINKY, POSE_IDX.LEFT_INDEX],
  ],
  rightArm: [
    [POSE_IDX.RIGHT_SHOULDER, POSE_IDX.RIGHT_ELBOW],
    [POSE_IDX.RIGHT_ELBOW, POSE_IDX.RIGHT_WRIST],
    [POSE_IDX.RIGHT_WRIST, POSE_IDX.RIGHT_PINKY],
    [POSE_IDX.RIGHT_WRIST, POSE_IDX.RIGHT_INDEX],
    [POSE_IDX.RIGHT_WRIST, POSE_IDX.RIGHT_THUMB],
    [POSE_IDX.RIGHT_PINKY, POSE_IDX.RIGHT_INDEX],
  ],
  leftLeg: [
    [POSE_IDX.LEFT_HIP, POSE_IDX.LEFT_KNEE],
    [POSE_IDX.LEFT_KNEE, POSE_IDX.LEFT_ANKLE],
    [POSE_IDX.LEFT_ANKLE, POSE_IDX.LEFT_HEEL],
    [POSE_IDX.LEFT_HEEL, POSE_IDX.LEFT_FOOT_INDEX],
    [POSE_IDX.LEFT_ANKLE, POSE_IDX.LEFT_FOOT_INDEX],
  ],
  rightLeg: [
    [POSE_IDX.RIGHT_HIP, POSE_IDX.RIGHT_KNEE],
    [POSE_IDX.RIGHT_KNEE, POSE_IDX.RIGHT_ANKLE],
    [POSE_IDX.RIGHT_ANKLE, POSE_IDX.RIGHT_HEEL],
    [POSE_IDX.RIGHT_HEEL, POSE_IDX.RIGHT_FOOT_INDEX],
    [POSE_IDX.RIGHT_ANKLE, POSE_IDX.RIGHT_FOOT_INDEX],
  ],
  torso: [
    [POSE_IDX.LEFT_SHOULDER, POSE_IDX.RIGHT_SHOULDER],
    [POSE_IDX.LEFT_HIP, POSE_IDX.RIGHT_HIP],
    [POSE_IDX.LEFT_SHOULDER, POSE_IDX.LEFT_HIP],
    [POSE_IDX.RIGHT_SHOULDER, POSE_IDX.RIGHT_HIP],
  ],
  face: [
    [POSE_IDX.LEFT_EYE_INNER, POSE_IDX.LEFT_EYE],
    [POSE_IDX.LEFT_EYE, POSE_IDX.LEFT_EYE_OUTER],
    [POSE_IDX.LEFT_EYE_OUTER, POSE_IDX.LEFT_EAR],
    [POSE_IDX.RIGHT_EYE_INNER, POSE_IDX.RIGHT_EYE],
    [POSE_IDX.RIGHT_EYE, POSE_IDX.RIGHT_EYE_OUTER],
    [POSE_IDX.RIGHT_EYE_OUTER, POSE_IDX.RIGHT_EAR],
    [POSE_IDX.MOUTH_LEFT, POSE_IDX.MOUTH_RIGHT],
  ],
};

/**
 * Landmarks that drive gait analysis and should be visually emphasized.
 */
export const KEY_GAIT_LANDMARKS: readonly number[] = [
  POSE_IDX.LEFT_SHOULDER,
  POSE_IDX.RIGHT_SHOULDER,
  POSE_IDX.LEFT_HIP,
  POSE_IDX.RIGHT_HIP,
  POSE_IDX.LEFT_KNEE,
  POSE_IDX.RIGHT_KNEE,
  POSE_IDX.LEFT_ANKLE,
  POSE_IDX.RIGHT_ANKLE,
  POSE_IDX.LEFT_HEEL,
  POSE_IDX.RIGHT_HEEL,
  POSE_IDX.LEFT_FOOT_INDEX,
  POSE_IDX.RIGHT_FOOT_INDEX,
];

const LEFT_INDICES = new Set<number>([
  POSE_IDX.LEFT_SHOULDER,
  POSE_IDX.LEFT_ELBOW,
  POSE_IDX.LEFT_WRIST,
  POSE_IDX.LEFT_PINKY,
  POSE_IDX.LEFT_INDEX,
  POSE_IDX.LEFT_THUMB,
  POSE_IDX.LEFT_HIP,
  POSE_IDX.LEFT_KNEE,
  POSE_IDX.LEFT_ANKLE,
  POSE_IDX.LEFT_HEEL,
  POSE_IDX.LEFT_FOOT_INDEX,
]);

const RIGHT_INDICES = new Set<number>([
  POSE_IDX.RIGHT_SHOULDER,
  POSE_IDX.RIGHT_ELBOW,
  POSE_IDX.RIGHT_WRIST,
  POSE_IDX.RIGHT_PINKY,
  POSE_IDX.RIGHT_INDEX,
  POSE_IDX.RIGHT_THUMB,
  POSE_IDX.RIGHT_HIP,
  POSE_IDX.RIGHT_KNEE,
  POSE_IDX.RIGHT_ANKLE,
  POSE_IDX.RIGHT_HEEL,
  POSE_IDX.RIGHT_FOOT_INDEX,
]);

const FACE_INDICES = new Set<number>([
  POSE_IDX.NOSE,
  POSE_IDX.LEFT_EYE_INNER,
  POSE_IDX.LEFT_EYE,
  POSE_IDX.LEFT_EYE_OUTER,
  POSE_IDX.RIGHT_EYE_INNER,
  POSE_IDX.RIGHT_EYE,
  POSE_IDX.RIGHT_EYE_OUTER,
  POSE_IDX.LEFT_EAR,
  POSE_IDX.RIGHT_EAR,
  POSE_IDX.MOUTH_LEFT,
  POSE_IDX.MOUTH_RIGHT,
]);

const KEY_GAIT_SET = new Set<number>(KEY_GAIT_LANDMARKS);

const JOINT_LABELS: Record<number, string> = {
  [POSE_IDX.LEFT_HIP]: 'H',
  [POSE_IDX.RIGHT_HIP]: 'H',
  [POSE_IDX.LEFT_KNEE]: 'K',
  [POSE_IDX.RIGHT_KNEE]: 'K',
  [POSE_IDX.LEFT_ANKLE]: 'A',
  [POSE_IDX.RIGHT_ANKLE]: 'A',
};

export interface DrawSkeletonOptions {
  showLabels?: boolean;
  visibilityThreshold?: number;
  lineWidth?: number;
  pointRadius?: number;
  keyPointRadius?: number;
}

function colorForLandmark(idx: number): string {
  if (LEFT_INDICES.has(idx)) return CLINICAL_COLORS.left;
  if (RIGHT_INDICES.has(idx)) return CLINICAL_COLORS.right;
  if (FACE_INDICES.has(idx)) return CLINICAL_COLORS.face;
  return CLINICAL_COLORS.midline;
}

function drawConnectionGroup(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  connections: readonly Connection[],
  color: string,
  width: number,
  height: number,
  lineWidth: number,
  visibilityThreshold: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  for (const [a, b] of connections) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    const visA = la.visibility ?? 0;
    const visB = lb.visibility ?? 0;
    const minVis = Math.min(visA, visB);
    if (minVis <= 0) continue;
    ctx.globalAlpha = minVis < visibilityThreshold ? 0.3 : 0.95;
    ctx.beginPath();
    ctx.moveTo(la.x * width, la.y * height);
    ctx.lineTo(lb.x * width, lb.y * height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Render the clinical skeleton onto a 2D canvas context.
 * Landmark coordinates are expected to be normalized to [0, 1].
 */
export function drawClinicalSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[] | undefined | null,
  opts: DrawSkeletonOptions = {},
): void {
  if (!landmarks || landmarks.length === 0) return;

  const {
    showLabels = false,
    visibilityThreshold = 0.5,
    lineWidth = 3,
    pointRadius = 3,
    keyPointRadius = 7,
  } = opts;

  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  drawConnectionGroup(ctx, landmarks, CLINICAL_CONNECTIONS.torso, CLINICAL_COLORS.midline, width, height, lineWidth, visibilityThreshold);
  drawConnectionGroup(ctx, landmarks, CLINICAL_CONNECTIONS.face, CLINICAL_COLORS.face, width, height, Math.max(1, lineWidth - 1), visibilityThreshold);
  drawConnectionGroup(ctx, landmarks, CLINICAL_CONNECTIONS.leftArm, CLINICAL_COLORS.left, width, height, lineWidth, visibilityThreshold);
  drawConnectionGroup(ctx, landmarks, CLINICAL_CONNECTIONS.rightArm, CLINICAL_COLORS.right, width, height, lineWidth, visibilityThreshold);
  drawConnectionGroup(ctx, landmarks, CLINICAL_CONNECTIONS.leftLeg, CLINICAL_COLORS.left, width, height, lineWidth + 1, visibilityThreshold);
  drawConnectionGroup(ctx, landmarks, CLINICAL_CONNECTIONS.rightLeg, CLINICAL_COLORS.right, width, height, lineWidth + 1, visibilityThreshold);

  for (let i = 0; i < landmarks.length; i += 1) {
    const lm = landmarks[i];
    if (!lm) continue;
    const vis = lm.visibility ?? 0;
    if (vis <= 0) continue;
    const isKey = KEY_GAIT_SET.has(i);
    const color = colorForLandmark(i);
    const cx = lm.x * width;
    const cy = lm.y * height;
    ctx.globalAlpha = vis < visibilityThreshold ? 0.3 : 1;

    if (isKey) {
      ctx.beginPath();
      ctx.arc(cx, cy, keyPointRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = CLINICAL_COLORS.highlightStroke;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, pointRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (showLabels) {
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 3;
    for (const idx of KEY_GAIT_LANDMARKS) {
      const label = JOINT_LABELS[idx];
      if (!label) continue;
      const lm = landmarks[idx];
      if (!lm || (lm.visibility ?? 0) < visibilityThreshold) continue;
      const cx = lm.x * width + 10;
      const cy = lm.y * height;
      ctx.strokeText(label, cx, cy);
      ctx.fillText(label, cx, cy);
    }
  }
}

/**
 * Find the PoseFrame closest to the given timestamp using binary search.
 * Returns null if no frame is within the tolerance window.
 */
export function findPoseFrameAt(
  frames: readonly PoseFrame[],
  timeSec: number,
  tolerance = 0.1,
): PoseFrame | null {
  if (!frames || frames.length === 0) return null;
  if (!Number.isFinite(timeSec)) return null;

  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timestamp < timeSec) lo = mid + 1;
    else hi = mid;
  }

  const candidate = frames[lo];
  const prev = lo > 0 ? frames[lo - 1] : null;
  const chosen =
    prev && Math.abs(prev.timestamp - timeSec) < Math.abs(candidate.timestamp - timeSec)
      ? prev
      : candidate;

  return Math.abs(chosen.timestamp - timeSec) <= tolerance ? chosen : null;
}
