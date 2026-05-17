import type { PoseFrame, PoseLandmark } from './poseEstimation.ts';
import type { DerivedBiometrics, SegmentInfo } from '../types/session.ts';
import { MEDIAPIPE_SEGMENTS_WINTER } from '../types/session.ts';

const DEFAULT_FRAME_WIDTH_PX = 1280;
const DEFAULT_FRAME_HEIGHT_PX = 720;
const NOSE_TO_STATURE_RATIO = 0.92;
const DEFAULT_VISIBILITY_THRESHOLD = 0.7;

export interface HeightEstimationOptions {
  frameWidthPx?: number;
  frameHeightPx?: number;
  frameGroundWidthMeters?: number | null;
  pxPerMeter?: number | null;
  visibilityThreshold?: number;
}

export interface HeightEstimationResult {
  heightCm: number;
  confidence: number;
  sampleCount: number;
  medianNormalizedSpan: number;
}

export interface ScaleDerivationOptions {
  frameWidthPx?: number;
  frameHeightPx?: number;
  visibilityThreshold?: number;
}

export interface ScaleDerivationResult {
  pxPerMeter: number;
  frameGroundWidthMeters: number;
  confidence: number;
  sampleCount: number;
  medianNormalizedSpan: number;
}

export interface ComputeDerivedBiometricsInput {
  effectiveHeightCm: number;
  heightSource: 'manual' | 'estimated';
  estimatedHeightCm?: number;
  heightConfidence?: number;
  weightKg?: number | null;
  frameGroundWidthMeters?: number | null;
  pxPerMeter?: number | null;
  segmentDefinitions?: SegmentInfo[];
}

interface HeightSpanStats {
  median: number;
  standardDeviation: number;
  sampleCount: number;
  confidence: number;
}

function isVisible(landmark: PoseLandmark | undefined, threshold: number): landmark is PoseLandmark {
  if (!landmark) return false;
  return (
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y) &&
    Number.isFinite(landmark.z) &&
    Number.isFinite(landmark.visibility) &&
    (landmark.visibility ?? 0) >= threshold
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function collectNormalizedHeightSpans(frames: PoseFrame[], visibilityThreshold: number): number[] {
  const spans: number[] = [];

  for (const frame of frames) {
    const nose = frame.landmarks[0];
    const leftAnkle = frame.landmarks[27];
    const rightAnkle = frame.landmarks[28];
    const leftShoulder = frame.landmarks[11];
    const rightShoulder = frame.landmarks[12];
    const leftHip = frame.landmarks[23];
    const rightHip = frame.landmarks[24];

    if (
      !isVisible(nose, visibilityThreshold) ||
      !isVisible(leftAnkle, visibilityThreshold) ||
      !isVisible(rightAnkle, visibilityThreshold) ||
      !isVisible(leftShoulder, visibilityThreshold) ||
      !isVisible(rightShoulder, visibilityThreshold) ||
      !isVisible(leftHip, visibilityThreshold) ||
      !isVisible(rightHip, visibilityThreshold)
    ) {
      continue;
    }

    const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
    const span = ankleY - nose.y;
    if (Number.isFinite(span) && span > 0.2 && span < 1.2) {
      spans.push(span);
    }
  }

  return spans;
}

function computeHeightSpanStats(frames: PoseFrame[], visibilityThreshold: number): HeightSpanStats | null {
  const spans = collectNormalizedHeightSpans(frames, visibilityThreshold);
  if (spans.length < 5) return null;

  const med = median(spans);
  const variance = spans.reduce((acc, value) => acc + (value - med) ** 2, 0) / spans.length;
  const standardDeviation = Math.sqrt(variance);

  const coverage = clamp(spans.length / 30, 0, 1);
  const variabilityPenalty = clamp(1 - standardDeviation / Math.max(med * 0.25, 1e-6), 0, 1);
  const confidence = Number((coverage * 0.5 + variabilityPenalty * 0.5).toFixed(3));

  return {
    median: med,
    standardDeviation,
    sampleCount: spans.length,
    confidence,
  };
}

export function deriveScaleFromHeight(
  frames: PoseFrame[],
  heightCm: number,
  options: ScaleDerivationOptions = {},
): ScaleDerivationResult | null {
  if (!(Number.isFinite(heightCm) && heightCm > 0) || frames.length < 5) return null;

  const visibilityThreshold = options.visibilityThreshold ?? DEFAULT_VISIBILITY_THRESHOLD;
  const stats = computeHeightSpanStats(frames, visibilityThreshold);
  if (!stats) return null;

  const frameWidthPx = options.frameWidthPx ?? DEFAULT_FRAME_WIDTH_PX;
  const frameHeightPx = options.frameHeightPx ?? DEFAULT_FRAME_HEIGHT_PX;
  const heightMeters = heightCm / 100;
  const frameGroundHeightMeters = (heightMeters * NOSE_TO_STATURE_RATIO) / stats.median;
  const frameGroundWidthMeters = frameGroundHeightMeters * (frameWidthPx / frameHeightPx);
  const pxPerMeter = frameWidthPx / frameGroundWidthMeters;

  if (!(Number.isFinite(pxPerMeter) && pxPerMeter > 0 && Number.isFinite(frameGroundWidthMeters) && frameGroundWidthMeters > 0)) {
    return null;
  }

  return {
    pxPerMeter,
    frameGroundWidthMeters,
    confidence: stats.confidence,
    sampleCount: stats.sampleCount,
    medianNormalizedSpan: stats.median,
  };
}

export function estimateHeightFromPose(
  frames: PoseFrame[],
  options: HeightEstimationOptions = {},
): HeightEstimationResult | null {
  if (frames.length < 5) return null;

  const visibilityThreshold = options.visibilityThreshold ?? DEFAULT_VISIBILITY_THRESHOLD;
  const stats = computeHeightSpanStats(frames, visibilityThreshold);
  if (!stats) return null;

  const frameWidthPx = options.frameWidthPx ?? DEFAULT_FRAME_WIDTH_PX;
  const frameHeightPx = options.frameHeightPx ?? DEFAULT_FRAME_HEIGHT_PX;

  const frameGroundWidthMeters =
    options.frameGroundWidthMeters != null && Number.isFinite(options.frameGroundWidthMeters) && options.frameGroundWidthMeters > 0
      ? options.frameGroundWidthMeters
      : options.pxPerMeter != null && Number.isFinite(options.pxPerMeter) && options.pxPerMeter > 0
        ? frameWidthPx / options.pxPerMeter
        : null;
  if (frameGroundWidthMeters == null) return null;

  const frameGroundHeightMeters = frameGroundWidthMeters * (frameHeightPx / frameWidthPx);
  const estimatedHeightMeters = (stats.median * frameGroundHeightMeters) / NOSE_TO_STATURE_RATIO;
  const heightCm = estimatedHeightMeters * 100;

  if (!(Number.isFinite(heightCm) && heightCm > 0)) return null;

  return {
    heightCm,
    confidence: stats.confidence,
    sampleCount: stats.sampleCount,
    medianNormalizedSpan: stats.median,
  };
}

export function computeDerivedBiometrics(input: ComputeDerivedBiometricsInput): DerivedBiometrics {
  const effectiveHeightCm = Number(input.effectiveHeightCm);
  const legLengthCm = effectiveHeightCm * 0.53;
  const weightKg =
    input.weightKg != null && Number.isFinite(input.weightKg) && input.weightKg > 0 ? input.weightKg : null;
  const bmi = weightKg != null ? weightKg / ((effectiveHeightCm / 100) ** 2) : null;

  const segmentDefinitions = input.segmentDefinitions ?? MEDIAPIPE_SEGMENTS_WINTER;
  const segmentMassesKg =
    weightKg == null
      ? null
      : Object.fromEntries(
          segmentDefinitions.map((segment) => [
            segment.name,
            Number((weightKg * segment.massPercentage).toFixed(6)),
          ]),
        );

  return {
    effectiveHeightCm,
    estimatedHeightCm: input.estimatedHeightCm,
    heightSource: input.heightSource,
    heightConfidence: clamp(input.heightConfidence ?? 0.8, 0, 1),
    legLengthCm,
    bmi: bmi != null ? Number(bmi.toFixed(4)) : null,
    weightKg,
    frameGroundWidthMeters:
      input.frameGroundWidthMeters != null && Number.isFinite(input.frameGroundWidthMeters)
        ? input.frameGroundWidthMeters
        : null,
    pxPerMeter:
      input.pxPerMeter != null && Number.isFinite(input.pxPerMeter)
        ? input.pxPerMeter
        : null,
    segmentMassesKg,
  };
}
