import { describe, expect, it } from 'vitest';
import { assertCoordinateSystem, c3dToOpenSim, c3dToUnity, c3dToUnreal, pixelToWorld } from '../lib/coordinateTransforms.ts';

describe('coordinateTransforms', () => {
  it('transforms c3d z-up mm to opensim y-up m', () => {
    const converted = c3dToOpenSim({ x: 1000, y: 500, z: 1200 });
    expect(converted.x).toBeCloseTo(1);
    expect(converted.y).toBeCloseTo(1.2);
    expect(converted.z).toBeCloseTo(-0.5);
  });

  it('maps points for unity and unreal conventions', () => {
    const unity = c3dToUnity({ x: 1000, y: 500, z: 1200 });
    const unreal = c3dToUnreal({ x: 1000, y: 500, z: 1200 });
    expect(unity.z).toBeCloseTo(0.5);
    expect(unreal.x).toBeCloseTo(100);
    expect(unreal.z).toBeCloseTo(120);
  });

  it('converts pixel coordinates to world meters', () => {
    const world = pixelToWorld({ x: 640, y: 360, z: 0 }, { frameWidthPx: 1280, frameHeightPx: 720, groundWidthMeters: 2 });
    expect(world.x).toBeCloseTo(1);
    expect(world.y).toBeCloseTo(0.5625);
  });

  it('throws on mismatched coordinate metadata', () => {
    expect(() =>
      assertCoordinateSystem(
        { axis: 'right-handed-z-up', unit: 'mm' },
        { axis: 'right-handed-y-up', unit: 'm' },
      ),
    ).toThrow();
  });
});
