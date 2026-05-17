import type { SessionData } from '../../types/session.ts';
import { validateGaitEvents } from '../eventValidation.ts';

export interface SidecarExportOptions {
  targetSystem: 'OpenSim' | 'Visual3D' | 'AnyBody' | 'Generic';
  coordinateMode: 'zup_mm' | 'yup_m';
}

export interface ExportSidecarDocument {
  schemaVersion: '1.0';
  generatedAtIso: string;
  sessionId: string;
  targetSystem: SidecarExportOptions['targetSystem'];
  coordinateMode: SidecarExportOptions['coordinateMode'];
  capture: {
    viewMode: SessionData['captureSettings']['viewMode'];
    fpsDetected: number | null;
    durationSeconds: number | null;
    frameGroundWidthMeters: number | null;
    pxPerMeter: number | null;
  };
  quality: SessionData['quality'];
  events: Array<{
    id: string;
    timestamp: number;
    foot: 'L' | 'R';
    type: SessionData['events'][number]['type'];
    source: SessionData['events'][number]['source'];
    confidence: number | null;
    reviewStatus: SessionData['events'][number]['reviewStatus'];
    qualityFlags: SessionData['events'][number]['qualityFlags'];
    clinicalNote: string | null;
  }>;
  eventValidation: ReturnType<typeof validateGaitEvents>;
  metrics: SessionData['metrics'];
  advancedMetrics: SessionData['advancedMetrics'];
  reviewSnapshot: SessionData['reviewSnapshot'];
  notes: {
    motSemantics: string;
    trcUnits: 'm' | 'mm';
    c3dUnits: 'mm';
  };
}

export function buildExportSidecar(
  session: SessionData,
  options: SidecarExportOptions,
): ExportSidecarDocument {
  const eventValidation =
    session.eventValidation ??
    validateGaitEvents(session.events, {
      durationSeconds: session.quality.durationSeconds,
    });

  return {
    schemaVersion: '1.0',
    generatedAtIso: new Date().toISOString(),
    sessionId: session.sessionId,
    targetSystem: options.targetSystem,
    coordinateMode: options.coordinateMode,
    capture: {
      viewMode: session.captureSettings.viewMode,
      fpsDetected: session.quality.fpsDetected,
      durationSeconds: session.quality.durationSeconds,
      frameGroundWidthMeters:
        session.derivedBiometrics?.frameGroundWidthMeters ??
        session.captureSettings.frameGroundWidthMeters ??
        null,
      pxPerMeter:
        session.derivedBiometrics?.pxPerMeter ??
        session.captureSettings.pxPerMeter ??
        null,
    },
    quality: session.quality,
    events: session.events
      .map((event) => ({
        id: event.id,
        timestamp: Number(event.timestamp.toFixed(3)),
        foot: event.foot,
        type: event.type,
        source: event.source,
        confidence: event.confidence,
        reviewStatus: event.reviewStatus,
        qualityFlags: event.qualityFlags,
        clinicalNote: event.clinicalNote,
      }))
      .sort((a, b) => a.timestamp - b.timestamp),
    eventValidation,
    metrics: session.metrics,
    advancedMetrics: session.advancedMetrics,
    reviewSnapshot: session.reviewSnapshot,
    notes: {
      motSemantics:
        'MOT representa cargas externas. Si no hay fuerzas medidas/importadas, el archivo MOT puede contener valores cero (placeholder).',
      trcUnits: options.coordinateMode === 'yup_m' ? 'm' : 'mm',
      c3dUnits: 'mm',
    },
  };
}
