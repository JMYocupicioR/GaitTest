import type { JointAngleTimeSeries } from '../types/session.ts';
import type { GaitCycle } from './advancedEventDetection.ts';

const EPSILON = 1e-6;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateAtTime(
  timestamps: number[],
  values: number[],
  targetTime: number,
): number {
  if (!timestamps.length || !values.length || timestamps.length !== values.length) {
    return 0;
  }
  if (targetTime <= timestamps[0]) {
    return values[0];
  }
  if (targetTime >= timestamps[timestamps.length - 1]) {
    return values[values.length - 1];
  }
  for (let i = 1; i < timestamps.length; i += 1) {
    const t0 = timestamps[i - 1];
    const t1 = timestamps[i];
    if (targetTime <= t1) {
      const ratio = (targetTime - t0) / Math.max(EPSILON, t1 - t0);
      return lerp(values[i - 1], values[i], ratio);
    }
  }
  return values[values.length - 1];
}

/**
 * Resamples an angle series into equally spaced percent points of a gait cycle.
 */
export function resampleToPercentCycle(
  timestamps: number[],
  values: number[],
  cycleStart: number,
  cycleEnd: number,
  points = 101,
): number[] {
  if (!timestamps.length || !values.length || points < 2) {
    return [];
  }
  if (!Number.isFinite(cycleStart) || !Number.isFinite(cycleEnd) || cycleEnd <= cycleStart) {
    return [];
  }
  const output: number[] = [];
  const duration = cycleEnd - cycleStart;
  for (let i = 0; i < points; i += 1) {
    const pct = i / (points - 1);
    const t = cycleStart + duration * pct;
    output.push(interpolateAtTime(timestamps, values, t));
  }
  return output;
}

/**
 * Extracts per-cycle normalized series for a specific foot.
 */
export function extractCyclesFromAngleSeries(
  series: JointAngleTimeSeries | undefined,
  cycles: GaitCycle[] | undefined,
  foot: 'L' | 'R',
  points = 101,
): number[][] {
  if (!series || !cycles || cycles.length === 0) {
    return [];
  }
  const validTimestamps = series.timestamps;
  const validAngles = series.angles;
  if (!validTimestamps.length || !validAngles.length) {
    return [];
  }
  return cycles
    .filter((cycle) => cycle.foot === foot && cycle.endTime > cycle.startTime)
    .map((cycle) =>
      resampleToPercentCycle(validTimestamps, validAngles, cycle.startTime, cycle.endTime, points),
    )
    .filter((cycle) => cycle.length === points);
}

/**
 * Computes point-wise mean and standard deviation from normalized cycles.
 */
export function averageCycles(cycles: number[][]): {
  mean: number[];
  sd: number[];
} {
  if (!cycles.length) {
    return { mean: [], sd: [] };
  }
  const length = cycles[0].length;
  if (!length) {
    return { mean: [], sd: [] };
  }
  const mean = new Array<number>(length).fill(0);
  const sd = new Array<number>(length).fill(0);

  for (const cycle of cycles) {
    for (let i = 0; i < length; i += 1) {
      mean[i] += cycle[i];
    }
  }
  for (let i = 0; i < length; i += 1) {
    mean[i] /= cycles.length;
  }
  for (const cycle of cycles) {
    for (let i = 0; i < length; i += 1) {
      const diff = cycle[i] - mean[i];
      sd[i] += diff * diff;
    }
  }
  for (let i = 0; i < length; i += 1) {
    sd[i] = Math.sqrt(sd[i] / cycles.length);
  }
  return { mean, sd };
}
