import { create } from 'zustand';
import { DEFAULT_OBSERVATIONS } from '../types/session.ts';
import type {
  CaptureQuality,
  CaptureSettings,
  GaitEvent,
  ObservationChecklist,
  PatternFlag,
  ReportSummary,
  SessionData,
  SessionMetrics,
  OGSScore,
} from '../types/session.ts';
import { computeMetrics } from '../lib/metrics.ts';
import { evaluatePatterns } from '../lib/patterns.ts';
import { buildReport } from '../lib/report.ts';
import { EnhancedGaitAnalyzer } from '../lib/enhancedAnalysis.ts';
import { ogsAnalyzer } from '../lib/ogsAnalysis.ts';
import { DataService } from '../services/dataService.ts';
import type { HeelStrikeEvent, PoseFrame } from '../lib/poseEstimation.ts';
import type { DetectedGaitEvent } from '../lib/advancedEventDetection.ts';
import { runAnalysisWithWorkerFallback } from '../lib/analysisWorkerClient.ts';
import {
  computeDerivedBiometrics,
  deriveScaleFromHeight,
  estimateHeightFromPose,
} from '../lib/biometricCalibration.ts';
import {
  createEventReviewDefaults,
  ensureEventReviewFields,
  getValidatedEventsForExport,
  isEventProtectedFromAutoSync,
  validateGaitEvents as validateGaitEventsData,
} from '../lib/eventValidation.ts';

const initialMetrics = (): SessionMetrics => ({
  durationSeconds: null,
  steps: 0,
  speedMps: null,
  cadenceSpm: null,
  stepLengthMeters: null,
  leftStepLengthMeters: null,
  rightStepLengthMeters: null,
  stanceTimeLeft: null,
  stanceTimeRight: null,
  stanceAsymmetryPct: null,
});

const sanitizeTimestamp = (timestamp: number): number =>
  Number.isFinite(timestamp) ? Math.max(0, Number.parseFloat(timestamp.toFixed(2))) : 0;

const sanitizeConfidence = (confidence: number | null | undefined, fallback: number): number => {
  if (confidence == null || !Number.isFinite(confidence)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, confidence));
};

const buildGaitEvent = (
  payload: Pick<GaitEvent, 'foot' | 'type' | 'source' | 'timestamp'> & Partial<GaitEvent>,
): GaitEvent => {
  const merged = {
    ...createEventReviewDefaults(),
    ...payload,
  };
  return {
    ...merged,
    id: merged.id ?? crypto.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: sanitizeTimestamp(merged.timestamp),
    confidence:
      merged.confidence != null
        ? sanitizeConfidence(merged.confidence, 0.5)
        : merged.source === 'manual'
          ? 0.7
          : 0.5,
    qualityFlags: [...new Set(merged.qualityFlags ?? [])],
  };
};

const mergeEvents = (events: GaitEvent[]): GaitEvent[] =>
  events
    .map(ensureEventReviewFields)
    .sort((a, b) => a.timestamp - b.timestamp);

const attachValidation = (session: SessionData): SessionData => {
  const normalizedEvents = mergeEvents(session.events);
  const validation = validateGaitEventsData(normalizedEvents, {
    durationSeconds: session.quality.durationSeconds,
  });
  const eventsWithFlags = normalizedEvents.map((event) => ({
    ...event,
    qualityFlags: validation.flagsByEventId[event.id] ?? [],
  }));
  return {
    ...session,
    events: eventsWithFlags,
    eventValidation: validation,
  };
};

const buildReviewSnapshot = (session: SessionData, metricsPreview: SessionMetrics, suggestedFlags: PatternFlag[]): SessionData['reviewSnapshot'] => {
  const validation = session.eventValidation ?? validateGaitEventsData(session.events, {
    durationSeconds: session.quality.durationSeconds,
  });
  const ogsEntries = [
    ...(session.ogs?.leftScore ? Object.values(session.ogs.leftScore) : []),
    ...(session.ogs?.rightScore ? Object.values(session.ogs.rightScore) : []),
  ];
  const filled = ogsEntries.filter((value) => value !== null).length;
  const total = ogsEntries.length || 16;
  return {
    validatedAtIso: new Date().toISOString(),
    eventValidation: validation,
    suggestedFlags,
    metricsPreview,
    ogsCompletionPct: Math.round((filled / total) * 100),
  };
};

const createEmptySession = (): SessionData => ({
  sessionId: crypto.randomUUID?.() ?? `session-${Date.now()}`,
  complementarySessionId: null,
  createdAtIso: new Date().toISOString(),
  captureSettings: {
    viewMode: 'lateral',
    calibrationType: 'line',
    distanceMeters: 5,
    targetFps: 60,
    frameGroundWidthMeters: null,
    pxPerMeter: null,
    calibrationMethod: null,
    calibrationConfidence: null,
  },
  quality: {
    fpsDetected: null,
    lightingScore: 'medium',
    issues: [],
    confidence: 'medium',
    durationSeconds: null,
  },
  events: [],
  eventValidation: null,
  observations: { ...DEFAULT_OBSERVATIONS },
  metrics: initialMetrics(),
  patternFlags: [],
  report: {
    trafficLight: 'yellow',
    notes: '',
    pdfUrl: null,
  },
  ogs: null,
  patient: undefined,
  videoBlob: undefined,
  // Enhanced analysis data
  advancedMetrics: undefined,
  poseFrames: [],
  processedSkeleton: undefined,
  enhancedAnalysisResult: undefined,
});

interface BiometricCalibrationContext {
  captureSettings: CaptureSettings;
  derivedBiometrics?: SessionData['derivedBiometrics'];
  patientPatch?: Partial<NonNullable<SessionData['patient']>>;
}

function buildBiometricCalibrationContext(session: SessionData): BiometricCalibrationContext {
  const poseFrames = session.poseFrames ?? [];
  const captureSettings = { ...session.captureSettings };
  const manualHeight = session.patient?.height;
  const manualWeight = session.patient?.weight;

  const heightForScale = manualHeight;
  const manualScale =
    heightForScale != null && poseFrames.length >= 5
      ? deriveScaleFromHeight(poseFrames, heightForScale)
      : null;

  const estimatedHeight =
    manualHeight == null
      ? estimateHeightFromPose(poseFrames, {
          frameGroundWidthMeters: captureSettings.frameGroundWidthMeters,
          pxPerMeter: captureSettings.pxPerMeter,
        })
      : null;

  const effectiveHeight = manualHeight ?? estimatedHeight?.heightCm ?? null;
  const estimatedScale =
    manualHeight == null && effectiveHeight != null && poseFrames.length >= 5
      ? deriveScaleFromHeight(poseFrames, effectiveHeight)
      : null;
  const resolvedScale = manualScale ?? estimatedScale;

  const nextCaptureSettings: CaptureSettings = {
    ...captureSettings,
    frameGroundWidthMeters:
      resolvedScale?.frameGroundWidthMeters ??
      captureSettings.frameGroundWidthMeters,
    pxPerMeter:
      resolvedScale?.pxPerMeter ??
      captureSettings.pxPerMeter,
    calibrationConfidence:
      resolvedScale?.confidence ??
      captureSettings.calibrationConfidence,
  };

  if (!(effectiveHeight != null && Number.isFinite(effectiveHeight) && effectiveHeight > 0)) {
    return { captureSettings: nextCaptureSettings };
  }

  const derivedBiometrics = computeDerivedBiometrics({
    effectiveHeightCm: effectiveHeight,
    estimatedHeightCm: manualHeight == null ? estimatedHeight?.heightCm : undefined,
    heightSource: manualHeight != null ? 'manual' : 'estimated',
    heightConfidence:
      manualHeight != null
        ? resolvedScale?.confidence ?? 1
        : estimatedHeight?.confidence ?? resolvedScale?.confidence ?? 0.5,
    weightKg: manualWeight ?? null,
    frameGroundWidthMeters: nextCaptureSettings.frameGroundWidthMeters,
    pxPerMeter: nextCaptureSettings.pxPerMeter,
  });

  const patientPatch: Partial<NonNullable<SessionData['patient']>> =
    manualHeight != null
      ? {
          heightSource: 'manual',
        }
      : {
          estimatedHeight: estimatedHeight?.heightCm,
          heightSource: 'estimated',
        };

  return {
    captureSettings: nextCaptureSettings,
    derivedBiometrics,
    patientPatch,
  };
}

interface SessionStore {
  session: SessionData;
  resetSession: () => void;
  setCaptureSettings: (updates: Partial<CaptureSettings>) => void;
  updateQuality: (updates: Partial<CaptureQuality>) => void;
  setDuration: (durationSeconds: number | null) => void;
  addGaitEvent: (event: {
    foot: 'L' | 'R';
    timestamp: number;
    type: GaitEvent['type'];
    source?: GaitEvent['source'];
    confidence?: number | null;
    frameIndex?: number | null;
  }) => void;
  addHeelStrike: (
    foot: 'L' | 'R',
    timestamp: number,
    source?: GaitEvent['source'],
    confidence?: number | null,
  ) => void;
  syncOfflineAutoHeelStrikes: (strikes: HeelStrikeEvent[]) => void;
  syncDetectedGaitEvents: (events: DetectedGaitEvent[]) => void;
  clearGaitEvents: () => void;
  updateEvent: (eventId: string, updates: Partial<GaitEvent>) => void;
  updateEventType: (eventId: string, type: GaitEvent['type']) => void;
  confirmEvent: (eventId: string, reviewer?: string | null) => void;
  rejectEvent: (eventId: string, reviewer?: string | null) => void;
  bulkConfirmEvents: (eventIds?: string[], reviewer?: string | null) => void;
  validateGaitEvents: () => SessionData['eventValidation'];
  removeEvent: (eventId: string) => void;
  setObservations: (updates: Partial<ObservationChecklist>) => void;
  setOGSScore: (leftScore: OGSScore, rightScore: OGSScore) => void;
  setReviewSnapshot: (snapshot: SessionData['reviewSnapshot']) => void;
  finalizeAnalysis: () => Promise<void>;
  setVideoBlob: (blob: Blob | undefined) => void;
  setPatientInfo: (updates: Partial<NonNullable<SessionData['patient']>>) => void;
  setReportSummary: (updates: Partial<ReportSummary>) => void;
  setPoseFrames: (frames: PoseFrame[]) => void;
  performEnhancedAnalysis: () => Promise<void>;
  saveSessionToDatabase: () => Promise<string | null>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: createEmptySession(),

  resetSession: () => set({ session: createEmptySession() }),

  setCaptureSettings: (updates) =>
    set(({ session }) => ({
      session: {
        ...session,
        captureSettings: { ...session.captureSettings, ...updates },
      },
    })),

  updateQuality: (updates) =>
    set(({ session }) => {
      const nextSession = {
        ...session,
        quality: { ...session.quality, ...updates },
      };
      return { session: attachValidation(nextSession) };
    }),

  setDuration: (durationSeconds) =>
    set(({ session }) => {
      const nextSession = {
        ...session,
        quality: { ...session.quality, durationSeconds },
      };
      return { session: attachValidation(nextSession) };
    }),

  addGaitEvent: ({ foot, timestamp, type, source = 'manual', confidence = null, frameIndex = null }) =>
    set(({ session }) => {
      const sanitized = sanitizeTimestamp(timestamp);
      const DEDUP_S = 0.12;
      if (source === 'auto') {
        const duplicate = session.events.find(
          (event) =>
            event.source === 'auto' &&
            event.type === type &&
            event.foot === foot &&
            Math.abs(event.timestamp - sanitized) < DEDUP_S,
        );
        if (duplicate) {
          return { session };
        }
      }
      const nextSession = {
        ...session,
        events: [
          ...session.events,
          buildGaitEvent({
            foot,
            timestamp: sanitized,
            type,
            source,
            confidence,
            frameIndex,
          }),
        ],
      };
      return { session: attachValidation(nextSession) };
    }),

  addHeelStrike: (foot, timestamp, source = 'manual', confidence = null) => {
    get().addGaitEvent({
      foot,
      timestamp,
      type: 'heel_strike',
      source,
      confidence,
    });
  },

  syncOfflineAutoHeelStrikes: (strikes) =>
    set(({ session }) => {
      const DEDUP_S = 0.12;
      const protectedEvents = session.events.filter((event) => {
        if (event.source !== 'auto' || event.type !== 'heel_strike') {
          return true;
        }
        return isEventProtectedFromAutoSync(ensureEventReviewFields(event));
      });
      const sorted = [...strikes].sort((a, b) => a.timestamp - b.timestamp);
      const deduped: HeelStrikeEvent[] = [];
      for (const s of sorted) {
        const prev = deduped[deduped.length - 1];
        if (prev && prev.foot === s.foot && Math.abs(s.timestamp - prev.timestamp) < DEDUP_S) {
          continue;
        }
        deduped.push(s);
      }
      const newAutoEvents: GaitEvent[] = deduped.map((strike) =>
        buildGaitEvent({
          foot: strike.foot,
          timestamp: strike.timestamp,
          type: 'heel_strike',
          source: 'auto',
          confidence: sanitizeConfidence(strike.confidence, 0.5),
        }),
      );
      const merged = [...protectedEvents, ...newAutoEvents];
      const nextSession = { ...session, events: merged };
      return { session: attachValidation(nextSession) };
    }),

  syncDetectedGaitEvents: (events) =>
    set(({ session }) => {
      const DEDUP_S = 0.12;
      const replaceableAuto = session.events.filter((event) => !isEventProtectedFromAutoSync(ensureEventReviewFields(event)));
      const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
      const deduped: DetectedGaitEvent[] = [];
      for (const current of sorted) {
        const prev = deduped[deduped.length - 1];
        if (
          prev &&
          prev.foot === current.foot &&
          prev.type === current.type &&
          Math.abs(prev.timestamp - current.timestamp) < DEDUP_S
        ) {
          continue;
        }
        deduped.push(current);
      }

      const autoEvents: GaitEvent[] = deduped.map((event) =>
        buildGaitEvent({
          foot: event.foot,
          timestamp: event.timestamp,
          type: event.type,
          source: 'auto',
          confidence: sanitizeConfidence(event.confidence ?? null, 0.5),
        }),
      );
      const staleAutoIds = new Set(replaceableAuto.map((event) => event.id));
      const withoutStaleAuto = session.events.filter((event) => !staleAutoIds.has(event.id));
      const merged = [...withoutStaleAuto, ...autoEvents];
      const uniqueById = Array.from(new Map(merged.map((event) => [event.id, event])).values());
      const nextSession = { ...session, events: uniqueById };
      return { session: attachValidation(nextSession) };
    }),

  clearGaitEvents: () =>
    set(({ session }) => {
      const nextSession = {
        ...session,
        events: [],
      };
      return { session: attachValidation(nextSession) };
    }),

  updateEvent: (eventId, updates) =>
    set(({ session }) => {
      const nextEvents = session.events.map((event) => {
        if (event.id !== eventId) {
          return ensureEventReviewFields(event);
        }
        const next = ensureEventReviewFields({
          ...event,
          ...updates,
          timestamp: updates.timestamp != null ? sanitizeTimestamp(updates.timestamp) : event.timestamp,
        });
        const touchedByUser =
          updates.timestamp != null ||
          updates.foot != null ||
          updates.type != null ||
          updates.clinicalNote != null ||
          updates.reviewStatus != null;
        return {
          ...next,
          source: touchedByUser ? 'manual' : next.source,
          userEdited: touchedByUser ? true : next.userEdited,
        };
      });
      return { session: attachValidation({ ...session, events: nextEvents }) };
    }),

  updateEventType: (eventId, type) => {
    get().updateEvent(eventId, { type });
  },

  confirmEvent: (eventId, reviewer = null) =>
    set(({ session }) => {
      const nextEvents = session.events.map((event) =>
        event.id === eventId
          ? ensureEventReviewFields({
              ...event,
              reviewStatus: 'confirmed',
              reviewedAtIso: new Date().toISOString(),
              reviewedBy: reviewer,
              userEdited: true,
              source: 'manual',
            })
          : ensureEventReviewFields(event),
      );
      return { session: attachValidation({ ...session, events: nextEvents }) };
    }),

  rejectEvent: (eventId, reviewer = null) =>
    set(({ session }) => {
      const nextEvents = session.events.map((event) =>
        event.id === eventId
          ? ensureEventReviewFields({
              ...event,
              reviewStatus: 'rejected',
              reviewedAtIso: new Date().toISOString(),
              reviewedBy: reviewer,
              userEdited: true,
            })
          : ensureEventReviewFields(event),
      );
      return { session: attachValidation({ ...session, events: nextEvents }) };
    }),

  bulkConfirmEvents: (eventIds, reviewer = null) =>
    set(({ session }) => {
      const targetIds = new Set(
        eventIds && eventIds.length > 0
          ? eventIds
          : session.events.map((event) => event.id),
      );
      const nextEvents = session.events.map((event) =>
        targetIds.has(event.id)
          ? ensureEventReviewFields({
              ...event,
              reviewStatus: event.reviewStatus === 'rejected' ? 'rejected' : 'confirmed',
              reviewedAtIso: new Date().toISOString(),
              reviewedBy: reviewer,
              userEdited: event.reviewStatus === 'rejected' ? event.userEdited : true,
              source: event.reviewStatus === 'rejected' ? event.source : 'manual',
            })
          : ensureEventReviewFields(event),
      );
      return { session: attachValidation({ ...session, events: nextEvents }) };
    }),

  validateGaitEvents: () => {
    const { session } = get();
    const validated = attachValidation(session);
    set({ session: validated });
    return validated.eventValidation;
  },

  removeEvent: (eventId) =>
    set(({ session }) => {
      const nextSession = {
        ...session,
        events: session.events.filter((event) => event.id !== eventId),
      };
      return { session: attachValidation(nextSession) };
    }),

  setObservations: (updates) =>
    set(({ session }) => ({
      session: {
        ...session,
        observations: { ...session.observations, ...updates },
      },
    })),

  setOGSScore: (leftScore, rightScore) =>
    set(({ session }) => {
      // Realizar análisis completo de OGS con correlaciones
      const ogsAnalysis = ogsAnalyzer.calculateOGSFinalScore(
        leftScore,
        rightScore,
        session,
        session.advancedMetrics,
        undefined, // kinematics - se puede agregar si está disponible
        undefined  // compensations - se puede agregar si está disponible
      );

      return {
        session: {
          ...session,
          ogs: ogsAnalysis,
        },
      };
    }),

  setReviewSnapshot: (snapshot) =>
    set(({ session }) => ({
      session: {
        ...session,
        reviewSnapshot: snapshot,
      },
    })),

  finalizeAnalysis: async () => {
    const { session } = get();
    const biometricCalibration = buildBiometricCalibrationContext(session);
    const validatedEvents = getValidatedEventsForExport(session);
    const validationSummary = get().validateGaitEvents();

    // Basic analysis (for backward compatibility)
    const metrics = computeMetrics({
      events: validatedEvents,
      distanceMeters: biometricCalibration.captureSettings.distanceMeters,
      durationSeconds: session.quality.durationSeconds,
    });

    const patternFlags = evaluatePatterns({
      metrics,
      observations: session.observations,
      viewMode: session.captureSettings.viewMode,
      quality: session.quality,
    });

    const report = buildReport({
      metrics,
      patternFlags,
      quality: session.quality,
    });
    const reviewSnapshot = buildReviewSnapshot(session, metrics, patternFlags);

    // Enhanced analysis if pose data is available
    if (session.poseFrames && session.poseFrames.length > 0) {
      try {
        const analysisPayload = {
          events: validatedEvents,
          captureSettings: biometricCalibration.captureSettings,
          quality: session.quality,
          observations: session.observations,
          poseFrames: session.poseFrames,
          derivedBiometrics: biometricCalibration.derivedBiometrics,
          ogs: session.ogs ?? undefined,
          patient: {
            identifier: session.patient?.identifier ?? 'N/A',
            age: session.patient?.age,
            sex: session.patient?.sex,
            height: session.patient?.height ?? biometricCalibration.derivedBiometrics?.effectiveHeightCm,
            weight: session.patient?.weight,
          },
        };
        const { result: enhancedResult, medReport } = await runAnalysisWithWorkerFallback(analysisPayload);

        const analyzer = new EnhancedGaitAnalyzer();
        const detectedEvents = enhancedResult.detectedGaitCycles?.flatMap((cycle) => cycle.events) ?? [];
        get().syncDetectedGaitEvents(detectedEvents);
        const updatedSession = get().session;
        const recomputedMetrics = computeMetrics({
          events: updatedSession.events,
          distanceMeters: biometricCalibration.captureSettings.distanceMeters,
          durationSeconds: updatedSession.quality.durationSeconds,
        });
        const recomputedPatternFlags = evaluatePatterns({
          metrics: recomputedMetrics,
          observations: updatedSession.observations,
          viewMode: updatedSession.captureSettings.viewMode,
          quality: updatedSession.quality,
        });
        const recomputedReport = buildReport({
          metrics: recomputedMetrics,
          patternFlags: recomputedPatternFlags,
          quality: updatedSession.quality,
        });

        const enhancedReport = analyzer.generateEnhancedReport(enhancedResult);

        const pathologyForSession = medReport.pathologyAnalysis;
        const enhancedResultWithClinical = {
          ...enhancedResult,
          pathologyAnalysis: pathologyForSession,
        };

        const clinicalAnalysisSnapshot = {
          schemaVersion: '1.0' as const,
          generatedAtIso: new Date().toISOString(),
          primaryDiagnosis: medReport.clinicalImpression.primaryDiagnosis,
          severity: medReport.clinicalImpression.severity,
          fallRiskCategory: medReport.functionalAssessment.fallRisk,
          mobilityLevel: medReport.functionalAssessment.mobilityLevel,
          pathologyAnalysis: pathologyForSession,
        };

        // Update OGS analysis with enhanced data if available
        let updatedOGS = session.ogs;
        if (session.ogs && enhancedResult.advancedMetrics) {
          updatedOGS = ogsAnalyzer.calculateOGSFinalScore(
            session.ogs.leftScore!,
            session.ogs.rightScore!,
            session,
            enhancedResult.advancedMetrics,
            enhancedResult.kinematicSummary,
            enhancedResult.compensationAnalysis
          );
        }

        set(({ session: current }) => {
          const nextSession = {
            ...current,
            captureSettings: biometricCalibration.captureSettings,
            patient: {
              ...current.patient,
              ...biometricCalibration.patientPatch,
            },
            derivedBiometrics: biometricCalibration.derivedBiometrics ?? current.derivedBiometrics,
            metrics: recomputedMetrics,
            patternFlags: enhancedResult.combinedPatterns,
            report: {
              ...recomputedReport,
              notes: enhancedReport.summary,
            },
            advancedMetrics: enhancedResult.advancedMetrics,
            processedSkeleton: enhancedResult.processedSkeleton,
            clinicalAnalysisSnapshot,
            enhancedAnalysisResult: enhancedResultWithClinical,
            kinematics: (enhancedResult.kinematicSummary || enhancedResult.detailedKinematics || enhancedResult.kinematicReport)
              ? {
                  summary: enhancedResult.kinematicSummary,
                  detailed: enhancedResult.detailedKinematics,
                  report: enhancedResult.kinematicReport,
                }
              : current.kinematics,
            ogs: updatedOGS,
            eventValidation: validationSummary ?? current.eventValidation,
            reviewSnapshot,
          };
          return { session: attachValidation(nextSession) };
        });
      } catch (error) {
        console.error('Enhanced analysis failed, falling back to basic analysis:', error);

        set(({ session: current }) => {
          const nextSession = {
            ...current,
            captureSettings: biometricCalibration.captureSettings,
            patient: {
              ...current.patient,
              ...biometricCalibration.patientPatch,
            },
            derivedBiometrics: biometricCalibration.derivedBiometrics ?? current.derivedBiometrics,
            metrics,
            patternFlags,
            report,
            clinicalAnalysisSnapshot: undefined,
            enhancedAnalysisResult: undefined,
            advancedMetrics: undefined,
            processedSkeleton: undefined,
            eventValidation: validationSummary ?? current.eventValidation,
            reviewSnapshot,
          };
          return { session: attachValidation(nextSession) };
        });
      }
    } else {
      set(({ session: current }) => {
        const nextSession = {
          ...current,
          captureSettings: biometricCalibration.captureSettings,
          patient: {
            ...current.patient,
            ...biometricCalibration.patientPatch,
          },
          derivedBiometrics: biometricCalibration.derivedBiometrics ?? current.derivedBiometrics,
          metrics,
          patternFlags,
          report,
          clinicalAnalysisSnapshot: undefined,
          eventValidation: validationSummary ?? current.eventValidation,
          reviewSnapshot,
        };
        return { session: attachValidation(nextSession) };
      });
    }
  },

  performEnhancedAnalysis: async () => {
    const { session } = get();
    const biometricCalibration = buildBiometricCalibrationContext(session);
    const validatedEvents = getValidatedEventsForExport(session);

    if (!session.poseFrames || session.poseFrames.length === 0) {
      console.warn('No pose frames available for enhanced analysis');
      return;
    }

    try {
      const { result } = await runAnalysisWithWorkerFallback({
        events: validatedEvents,
        captureSettings: biometricCalibration.captureSettings,
        quality: session.quality,
        observations: session.observations,
        poseFrames: session.poseFrames,
        derivedBiometrics: biometricCalibration.derivedBiometrics,
        ogs: session.ogs ?? undefined,
        patient: {
          identifier: session.patient?.identifier ?? 'N/A',
          age: session.patient?.age,
          sex: session.patient?.sex,
          height: session.patient?.height ?? biometricCalibration.derivedBiometrics?.effectiveHeightCm,
          weight: session.patient?.weight,
        },
      });

      set(({ session: current }) => {
        const nextSession = {
          ...current,
          captureSettings: biometricCalibration.captureSettings,
          patient: {
            ...current.patient,
            ...biometricCalibration.patientPatch,
          },
          derivedBiometrics: biometricCalibration.derivedBiometrics ?? current.derivedBiometrics,
          advancedMetrics: result.advancedMetrics,
          processedSkeleton: result.processedSkeleton,
          enhancedAnalysisResult: result,
        };
        return { session: attachValidation(nextSession) };
      });
    } catch (error) {
      console.error('Enhanced analysis failed:', error);
    }
  },

  setPoseFrames: (frames) =>
    set(({ session }) => ({
      session: {
        ...session,
        poseFrames: frames,
      },
    })),

  setVideoBlob: (blob) =>
    set(({ session }) => ({
      session: {
        ...session,
        videoBlob: blob,
      },
    })),

  setPatientInfo: (updates) =>
    set(({ session }) => ({
      session: {
        ...session,
        patient: { ...session.patient, ...updates },
      },
    })),

  setReportSummary: (updates) =>
    set(({ session }) => ({
      session: {
        ...session,
        report: { ...session.report, ...updates },
      },
    })),

  saveSessionToDatabase: async () => {
    const { session } = get();
    try {
      const sessionId = await DataService.saveSession(session);

      if (sessionId) {
        console.log('Session saved successfully with ID:', sessionId);
        return sessionId;
      } else {
        console.error('Failed to save session');
        return null;
      }
    } catch (error) {
      console.error('Error saving session to database:', error);
      return null;
    }
  },
}));

