import { describe, expect, it } from 'vitest';
import { calculateAngle2D } from '../lib/kinematicAnalysis.ts';

describe('kinematicAnalysis basics', () => {
  it('calculateAngle2D returns approximately 90 degrees for orthogonal vectors', () => {
    const angle = calculateAngle2D(
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    );
    expect(angle).toBeCloseTo(90, 1);
  });
});
