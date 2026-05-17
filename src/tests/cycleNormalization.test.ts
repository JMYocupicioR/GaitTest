import { describe, expect, it } from 'vitest';
import { averageCycles, resampleToPercentCycle } from '../lib/cycleNormalization.ts';

describe('cycleNormalization', () => {
  it('resamples to 101 points between cycle bounds', () => {
    const timestamps = [0, 0.5, 1];
    const values = [10, 20, 30];
    const out = resampleToPercentCycle(timestamps, values, 0, 1, 101);
    expect(out).toHaveLength(101);
    expect(out[0]).toBeCloseTo(10, 4);
    expect(out[100]).toBeCloseTo(30, 4);
  });

  it('averages cycles point-wise with standard deviation', () => {
    const stats = averageCycles([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
    expect(stats.mean).toEqual([2, 3, 4]);
    expect(stats.sd[0]).toBeGreaterThan(0);
  });
});
