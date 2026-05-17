import { describe, expect, it } from 'vitest';
import { butterworthFilter, smoothAngleSeries, smoothLandmarkSeries } from '../lib/signalProcessing.ts';

describe('signalProcessing', () => {
  it('returns unchanged data for very short signals', () => {
    const signal = [1, 2, 3, 4, 5];
    expect(butterworthFilter(signal)).toEqual(signal);
  });

  it('preserves signal length when smoothing angles', () => {
    const noisyAngles = [10, 18, 12, 22, 14, 24, 16, 20, 18, 19];
    const smoothed = smoothAngleSeries(noisyAngles);
    expect(smoothed).toHaveLength(noisyAngles.length);
  });

  it('smooths landmark coordinates consistently', () => {
    const x = [0.1, 0.12, 0.11, 0.2, 0.15, 0.16, 0.17];
    const y = [0.5, 0.52, 0.48, 0.55, 0.51, 0.5, 0.49];
    const smoothed = smoothLandmarkSeries(x, y);

    expect(smoothed.x).toHaveLength(x.length);
    expect(smoothed.y).toHaveLength(y.length);
  });
});
