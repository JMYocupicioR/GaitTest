import type { GaitEvent, ProcessedSkeleton } from '../../types/session.ts';

export interface ForceSampleC3D {
  fx: number;
  fy: number;
  fz: number;
  copx: number;
  copy: number;
  copz: number;
  mx: number;
  my: number;
  mz: number;
}

export interface MOTExportOptions {
  frameRateHz?: number;
  verticalThresholdN?: number;
  defaultCopMeters?: { x: number; y: number; z: number };
}

function rotateForceC3dToOpenSim(force: { fx: number; fy: number; fz: number }) {
  return {
    fx: force.fx,
    fy: force.fz,
    fz: -force.fy,
  };
}

function rotatePointC3dToOpenSim(point: { x: number; y: number; z: number }) {
  return {
    x: point.x,
    y: point.z,
    z: -point.y,
  };
}

function rotateMomentC3dToOpenSim(moment: { mx: number; my: number; mz: number }) {
  return {
    mx: moment.mx,
    my: moment.mz,
    mz: -moment.my,
  };
}

function buildZeroForceSample(defaultCopMeters: { x: number; y: number; z: number }) {
  return {
    fx: 0,
    fy: 0,
    fz: 0,
    copx: defaultCopMeters.x,
    copy: defaultCopMeters.y,
    copz: defaultCopMeters.z,
    mx: 0,
    my: 0,
    mz: 0,
  };
}

/**
 * Exporta un archivo MOT compatible con OpenSim ExternalLoads.
 * Si no hay plataformas de fuerza reales, puede exportar valores en cero.
 */
export function exportToMOT(
  processedSkeleton: ProcessedSkeleton,
  gaitEvents: GaitEvent[] = [],
  forceSamplesC3D: ForceSampleC3D[] = [],
  options: MOTExportOptions = {},
): string {
  const frameRateHz = options.frameRateHz ?? 30;
  const verticalThresholdN = options.verticalThresholdN ?? 10;
  const defaultCopMeters = options.defaultCopMeters ?? { x: 0, y: 0, z: 0 };
  const hasMeasuredForces = forceSamplesC3D.length > 0;
  const eventsUsed = gaitEvents.filter((event) => event.reviewStatus !== 'rejected').length;

  const rows = processedSkeleton.frames.length || forceSamplesC3D.length || gaitEvents.length;
  const lines: string[] = [];
  lines.push('GaitTest_OpenSim_GRF');
  lines.push('version=1');
  lines.push(`nRows=${rows}`);
  lines.push('nColumns=10');
  lines.push(`grf_source=${hasMeasuredForces ? 'measured_or_imported' : 'placeholder_zero'}`);
  lines.push(`events_used=${eventsUsed}`);
  lines.push(`vertical_threshold_n=${verticalThresholdN.toFixed(1)}`);
  if (!hasMeasuredForces) {
    lines.push('warning=No force plate data available; external loads are exported as zero placeholders.');
  }
  lines.push('inDegrees=yes');
  lines.push('endheader');
  lines.push(
    'time\tground_force_vx\tground_force_vy\tground_force_vz\tground_force_px\tground_force_py\tground_force_pz\tground_torque_x\tground_torque_y\tground_torque_z',
  );

  for (let i = 0; i < rows; i += 1) {
    const frame = processedSkeleton.frames[i];
    const time = Number.isFinite(frame?.timestamp) ? frame.timestamp : i / frameRateHz;
    const sample = forceSamplesC3D[i];

    const base = sample
      ? {
          fx: sample.fx,
          fy: sample.fy,
          fz: sample.fz,
          copx: sample.copx,
          copy: sample.copy,
          copz: sample.copz,
          mx: sample.mx,
          my: sample.my,
          mz: sample.mz,
        }
      : buildZeroForceSample(defaultCopMeters);

    const force = rotateForceC3dToOpenSim(base);
    const cop = rotatePointC3dToOpenSim({ x: base.copx, y: base.copy, z: base.copz });
    const moment = rotateMomentC3dToOpenSim(base);

    if (force.fy < verticalThresholdN) {
      lines.push(
        `${time.toFixed(6)}\t0.000000\t0.000000\t0.000000\t${defaultCopMeters.x.toFixed(6)}\t${defaultCopMeters.y.toFixed(6)}\t${defaultCopMeters.z.toFixed(6)}\t0.000000\t0.000000\t0.000000`,
      );
      continue;
    }

    lines.push(
      `${time.toFixed(6)}\t${force.fx.toFixed(6)}\t${force.fy.toFixed(6)}\t${force.fz.toFixed(6)}\t${cop.x.toFixed(6)}\t${cop.y.toFixed(6)}\t${cop.z.toFixed(6)}\t${moment.mx.toFixed(6)}\t${moment.my.toFixed(6)}\t${moment.mz.toFixed(6)}`,
    );
  }

  return lines.join('\n');
}

export function downloadMOT(content: string, fileName: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
