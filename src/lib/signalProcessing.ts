/**
 * Signal Processing Utilities for Gait Analysis
 * Butterworth low-pass filter to smooth landmark position data
 * before kinematic angle calculation.
 */
import type { PoseFrame } from './poseEstimation.ts';

/**
 * 4th-order Butterworth low-pass filter coefficients.
 * Designed for 30 fps capture with 6 Hz cutoff frequency.
 *
 * Transfer function coefficients computed via bilinear transform:
 *   fc = 6 Hz, fs = 30 Hz, order = 4
 */
function butterworthCoefficients(cutoffHz: number, sampleRateHz: number) {
  const wc = Math.tan((Math.PI * cutoffHz) / sampleRateHz);
  const wc2 = wc * wc;
  const sqrt2 = Math.SQRT2;

  // 2nd-order section 1: poles at angles π/8 and 7π/8
  const k1 = sqrt2 * wc;
  const a0_1 = wc2 + k1 + 1;
  const b0_1 = wc2 / a0_1;
  const b1_1 = (2 * wc2) / a0_1;
  const b2_1 = wc2 / a0_1;
  const a1_1 = (2 * (wc2 - 1)) / a0_1;
  const a2_1 = (wc2 - k1 + 1) / a0_1;

  // 2nd-order section 2: poles at angles 3π/8 and 5π/8
  const k2 = 2 * Math.sin(Math.PI / 8) * wc;
  const a0_2 = wc2 + k2 + 1;
  const b0_2 = wc2 / a0_2;
  const b1_2 = (2 * wc2) / a0_2;
  const b2_2 = wc2 / a0_2;
  const a1_2 = (2 * (wc2 - 1)) / a0_2;
  const a2_2 = (wc2 - k2 + 1) / a0_2;

  return {
    section1: { b: [b0_1, b1_1, b2_1], a: [1, a1_1, a2_1] },
    section2: { b: [b0_2, b1_2, b2_2], a: [1, a1_2, a2_2] },
  };
}

/**
 * Apply a single 2nd-order IIR filter section (biquad) to data.
 */
function applyBiquad(
  data: number[],
  b: number[],
  a: number[],
): number[] {
  const n = data.length;
  const out = new Array<number>(n);

  // Initial conditions
  let x1 = data[0], x2 = data[0];
  let y1 = data[0], y2 = data[0];

  for (let i = 0; i < n; i++) {
    const x = data[i];
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }

  return out;
}

/**
 * Zero-phase (forward-backward) filtering to avoid phase distortion.
 */
function filtfilt(data: number[], b: number[], a: number[]): number[] {
  // Forward pass
  const forward = applyBiquad(data, b, a);
  // Reverse
  forward.reverse();
  // Backward pass
  const backward = applyBiquad(forward, b, a);
  // Reverse again to restore order
  backward.reverse();
  return backward;
}

/**
 * Apply 4th-order zero-phase Butterworth low-pass filter to a signal.
 *
 * @param data - Raw signal array
 * @param cutoffHz - Cutoff frequency in Hz (default: 6)
 * @param sampleRateHz - Sampling rate in Hz (default: 30)
 * @returns Filtered signal array
 */
export function butterworthFilter(
  data: number[],
  cutoffHz = 6,
  sampleRateHz = 30,
): number[] {
  if (data.length < 6) return [...data]; // Too short to filter

  const coeffs = butterworthCoefficients(cutoffHz, sampleRateHz);

  // Apply two cascaded 2nd-order sections with zero-phase filtering
  const stage1 = filtfilt(data, coeffs.section1.b, coeffs.section1.a);
  const stage2 = filtfilt(stage1, coeffs.section2.b, coeffs.section2.a);

  return stage2;
}

/**
 * Smooth a 2D array of landmark positions (x, y per frame).
 * Filters each coordinate independently.
 */
export function smoothLandmarkSeries(
  xPositions: number[],
  yPositions: number[],
  cutoffHz = 6,
  sampleRateHz = 30,
): { x: number[]; y: number[] } {
  return {
    x: butterworthFilter(xPositions, cutoffHz, sampleRateHz),
    y: butterworthFilter(yPositions, cutoffHz, sampleRateHz),
  };
}

/**
 * Smooths complete pose trajectories (33 landmarks x,y,z) across frames.
 * Visibility is preserved from the original frame.
 */
export function applyLandmarkFiltering(
  frames: PoseFrame[],
  cutoffHz = 6,
  sampleRateHz = 30,
): PoseFrame[] {
  if (!frames.length) {
    return [];
  }
  const landmarkCount = frames[0].landmarks.length;
  if (landmarkCount === 0 || frames.length < 6) {
    return frames.map((frame) => ({
      ...frame,
      landmarks: frame.landmarks.map((lm) => ({ ...lm })),
    }));
  }

  const filteredByIndex = new Array<{
    x: number[];
    y: number[];
    z: number[];
  }>(landmarkCount);

  for (let i = 0; i < landmarkCount; i += 1) {
    const xs = frames.map((f) => f.landmarks[i]?.x ?? 0);
    const ys = frames.map((f) => f.landmarks[i]?.y ?? 0);
    const zs = frames.map((f) => f.landmarks[i]?.z ?? 0);
    filteredByIndex[i] = {
      x: butterworthFilter(xs, cutoffHz, sampleRateHz),
      y: butterworthFilter(ys, cutoffHz, sampleRateHz),
      z: butterworthFilter(zs, cutoffHz, sampleRateHz),
    };
  }

  return frames.map((frame, frameIdx) => {
    const landmarks = frame.landmarks.map((lm, lmIdx) => ({
      x: filteredByIndex[lmIdx].x[frameIdx],
      y: filteredByIndex[lmIdx].y[frameIdx],
      z: filteredByIndex[lmIdx].z[frameIdx],
      visibility: lm.visibility,
    }));

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
  });
}

/**
 * Smooth a full angle time series.
 */
export function smoothAngleSeries(
  angles: number[],
  cutoffHz = 6,
  sampleRateHz = 30,
): number[] {
  return butterworthFilter(angles, cutoffHz, sampleRateHz);
}
