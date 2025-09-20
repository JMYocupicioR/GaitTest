import { z } from 'zod';
import type { SessionData } from '../types/session.ts';

export const patternStatusSchema = z.union([
  z.literal('likely'),
  z.literal('possible'),
  z.literal('unlikely'),
  z.literal('insufficient_data'),
  z.literal('not_assessed'),
]);

export const sessionPayloadSchema = z.object({
  session_id: z.string(),
  capture: z.object({
    view: z.enum(['lateral', 'frontal', 'dual']),
    distance_m: z.number().nullable(),
    fps: z.number().nullable(),
    quality: z.enum(['high', 'mid', 'low']),
  }),
  events: z
    .array(
      z.object({
        t: z.number().nonnegative(),
        foot: z.enum(['L', 'R']),
        type: z.enum(['heel_strike', 'toe_off', 'foot_flat', 'heel_off', 'max_knee_flexion', 'max_hip_extension']),
        source: z.enum(['auto', 'manual']).optional(),
        confidence: z.number().nullable().optional(),
      }),
    )
    .max(64),
  metrics: z.object({
    duration_s: z.number().nullable(),
    steps: z.number(),
    speed_mps: z.number().nullable(),
    cadence_spm: z.number().nullable(),
    step_length_m: z.number().nullable(),
    stance_asymmetry_pct: z.number().nullable(),
  }),
  flags: z.record(z.string(), patternStatusSchema),
  quality_issues: z.array(z.string()),
  report: z.object({
    traffic_light: z.enum(['green', 'yellow', 'red']),
    notes: z.string(),
    pdf_url: z.string().url().nullable(),
  }),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export const buildSessionPayload = (session: SessionData): SessionPayload => {
  const flagsRecord: Record<string, z.infer<typeof patternStatusSchema>> = {};
  session.patternFlags.forEach((flag) => {
    flagsRecord[flag.id] = flag.status;
  });

  const qualityMap = { high: 'high', medium: 'mid', low: 'low' } as const;
  const qualityValue = qualityMap[session.quality.confidence];

  const payload = {
    session_id: session.sessionId,
    capture: {
      view: session.captureSettings.viewMode,
      distance_m: session.captureSettings.distanceMeters ?? null,
      fps: session.quality.fpsDetected ?? null,
      quality: qualityValue,
    },
    events: session.events.map((event) => ({
      t: Number(event.timestamp.toFixed(2)),
      foot: event.foot,
      type: event.type,
      source: event.source,
      confidence: event.confidence,
    })),
    metrics: {
      duration_s: session.metrics.durationSeconds,
      steps: session.metrics.steps,
      speed_mps: session.metrics.speedMps,
      cadence_spm: session.metrics.cadenceSpm,
      step_length_m: session.metrics.stepLengthMeters,
      stance_asymmetry_pct: session.metrics.stanceAsymmetryPct,
    },
    flags: flagsRecord,
    quality_issues: session.quality.issues,
    report: {
      traffic_light: session.report.trafficLight,
      notes: session.report.notes,
      pdf_url: session.report.pdfUrl,
    },
  } satisfies SessionPayload;

  return sessionPayloadSchema.parse(payload);
};
