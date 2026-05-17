import type { ProcessedSkeleton } from '../../types/session.ts';
import { c3dToOpenSim } from '../coordinateTransforms.ts';
import {
  mapMediaPipeToPlugInGait,
  MEDIAPIPE_LANDMARK_NAMES,
  type MarkerNamingProfile,
} from '../markerNaming.ts';

export interface TRCExportOptions {
  fileName?: string;
  frameRateHz?: number;
  markerNames?: string[];
  visibilityThreshold?: number;
  groundWidthMeters?: number;
  coordinateMode?: 'zup_mm' | 'yup_m';
  markerNamingProfile?: MarkerNamingProfile;
}

function normalizedToC3dMm(
  value: { x: number; y: number; z: number },
  groundWidthMeters: number,
): { x: number; y: number; z: number } {
  const scaleMm = groundWidthMeters * 1000;
  return {
    x: value.x * scaleMm,
    y: value.y * scaleMm,
    z: value.z * scaleMm,
  };
}

export function exportToTRC(
  processedSkeleton: ProcessedSkeleton,
  options: TRCExportOptions = {},
): string {
  const frames = processedSkeleton.frames;
  const frameRateHz = options.frameRateHz ?? 30;
  const visibilityThreshold = options.visibilityThreshold ?? 0.5;
  const coordinateMode = options.coordinateMode ?? 'yup_m';
  const groundWidthMeters =
    options.groundWidthMeters != null && Number.isFinite(options.groundWidthMeters) && options.groundWidthMeters > 0
      ? options.groundWidthMeters
      : 1.8;
  const markerNames =
    options.markerNames && options.markerNames.length
      ? options.markerNames
      : mapMediaPipeToPlugInGait(
          MEDIAPIPE_LANDMARK_NAMES,
          options.markerNamingProfile ?? (coordinateMode === 'yup_m' ? 'opensim_model_generic' : 'plug_in_gait_partial'),
        );
  const markerCount = markerNames.length;

  const lines: string[] = [];
  lines.push(`PathFileType\t4\t(X/Y/Z)\t${options.fileName ?? 'gait_export.trc'}`);
  lines.push('DataRate\tCameraRate\tNumFrames\tNumMarkers\tUnits\tOrigDataRate\tOrigDataStartFrame\tOrigNumFrames');
  lines.push(`${frameRateHz}\t${frameRateHz}\t${frames.length}\t${markerCount}\t${coordinateMode === 'yup_m' ? 'm' : 'mm'}\t${frameRateHz}\t1\t${frames.length}`);

  const markerHeader = markerNames.map((name) => `${name}\t\t`).join('\t');
  lines.push(`Frame#\tTime\t${markerHeader}`);

  const axisHeader = Array.from({ length: markerCount }, (_, idx) => `X${idx + 1}\tY${idx + 1}\tZ${idx + 1}`).join('\t');
  lines.push(`\t\t${axisHeader}`);

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const time = Number.isFinite(frame.timestamp) ? frame.timestamp : frameIndex / frameRateHz;
    const row: string[] = [String(frameIndex + 1), time.toFixed(5)];

    for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
      const landmark = frame.landmarks[markerIndex];
      if (!landmark || (landmark.visibility ?? 0) < visibilityThreshold) {
        // OpenSim: oclusiones deben ir en blanco, no 0.
        row.push('', '', '');
        continue;
      }

      const c3dPoint = normalizedToC3dMm(landmark, groundWidthMeters);
      if (coordinateMode === 'yup_m') {
        const opensimPoint = c3dToOpenSim(c3dPoint);
        row.push(opensimPoint.x.toFixed(6), opensimPoint.y.toFixed(6), opensimPoint.z.toFixed(6));
      } else {
        row.push(c3dPoint.x.toFixed(3), c3dPoint.y.toFixed(3), c3dPoint.z.toFixed(3));
      }
    }

    lines.push(row.join('\t'));
  }

  return lines.join('\n');
}

export function downloadTRC(content: string, fileName: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
