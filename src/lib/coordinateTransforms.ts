export type AxisConvention = 'right-handed-z-up' | 'right-handed-y-up' | 'left-handed-y-up' | 'left-handed-z-up';
export type SpatialUnit = 'mm' | 'm' | 'cm' | 'normalized';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CoordinateMetadata {
  axis: AxisConvention;
  unit: SpatialUnit;
}

export interface PixelToWorldOptions {
  frameWidthPx?: number;
  frameHeightPx?: number;
  groundWidthMeters?: number;
  groundHeightMeters?: number;
  depthScaleMeters?: number;
}

const MM_TO_M = 0.001;

export function pixelToWorld(point: Vec3, options: PixelToWorldOptions = {}): Vec3 {
  const frameWidthPx = options.frameWidthPx ?? 1280;
  const frameHeightPx = options.frameHeightPx ?? 720;
  const groundWidthMeters = options.groundWidthMeters ?? 1.8;
  const groundHeightMeters = options.groundHeightMeters ?? groundWidthMeters * (frameHeightPx / frameWidthPx);
  const depthScaleMeters = options.depthScaleMeters ?? groundWidthMeters;

  return {
    x: (point.x / frameWidthPx) * groundWidthMeters,
    y: (point.y / frameHeightPx) * groundHeightMeters,
    z: (point.z / frameWidthPx) * depthScaleMeters,
  };
}

/**
 * Transformacion especificada en .C3D.md:
 * X = x*0.001, Y = z*0.001, Z = -y*0.001
 */
export function c3dToOpenSim(pointMmZUp: Vec3): Vec3 {
  return {
    x: pointMmZUp.x * MM_TO_M,
    y: pointMmZUp.z * MM_TO_M,
    z: -pointMmZUp.y * MM_TO_M,
  };
}

export function c3dToFBX(pointMmZUp: Vec3): Vec3 {
  return c3dToOpenSim(pointMmZUp);
}

export function c3dToUnity(pointMmZUp: Vec3): Vec3 {
  const yUp = c3dToOpenSim(pointMmZUp);
  return { x: yUp.x, y: yUp.y, z: -yUp.z };
}

export function c3dToUnreal(pointMmZUp: Vec3): Vec3 {
  // Unreal usa cm y left-handed Z-up.
  return {
    x: pointMmZUp.x * 0.1,
    y: -pointMmZUp.y * 0.1,
    z: pointMmZUp.z * 0.1,
  };
}

export function assertCoordinateSystem(
  metadata: CoordinateMetadata,
  expected: CoordinateMetadata,
): void {
  if (metadata.axis !== expected.axis || metadata.unit !== expected.unit) {
    throw new Error(
      `Coordinate system mismatch. Expected (${expected.axis}, ${expected.unit}) but got (${metadata.axis}, ${metadata.unit}).`,
    );
  }
}
