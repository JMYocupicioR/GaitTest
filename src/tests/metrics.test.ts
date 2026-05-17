import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../lib/metrics.ts';

describe('computeMetrics', () => {
  it('computes speed and cadence from ordered events', () => {
    const metrics = computeMetrics({
      events: [
        { foot: 'L', timestamp: 0.0 },
        { foot: 'R', timestamp: 0.5 },
        { foot: 'L', timestamp: 1.0 },
        { foot: 'R', timestamp: 1.5 },
      ],
      distanceMeters: 3,
      durationSeconds: 2,
    });

    expect(metrics.steps).toBe(4);
    expect(metrics.speedMps).toBeCloseTo(1.5, 3);
    expect(metrics.cadenceSpm).toBeCloseTo(120, 3);
    expect(metrics.stepLengthMeters).not.toBeNull();
  });

  it('falls back to derived duration when duration is missing', () => {
    const metrics = computeMetrics({
      events: [
        { foot: 'L', timestamp: 1.0 },
        { foot: 'R', timestamp: 2.0 },
      ],
      distanceMeters: 2,
      durationSeconds: null,
    });

    expect(metrics.durationSeconds).toBeCloseTo(1.0, 3);
    expect(metrics.speedMps).toBeCloseTo(2.0, 3);
  });
});
