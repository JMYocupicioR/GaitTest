import { create } from 'zustand';
import { DEFAULT_OBSERVATIONS } from '../types/session.ts';
import type {
  CaptureQuality,
  CaptureSettings,
  GaitEvent,
  ObservationChecklist,
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
  enhancedAnalysisResult: undefined,
});

interface SessionStore {
  session: SessionData;
  resetSession: () => void;
  setCaptureSettings: (updates: Partial<CaptureSettings>) => void;
  updateQuality: (updates: Partial<CaptureQuality>) => void;
  setDuration: (durationSeconds: number | null) => void;
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
  removeEvent: (eventId: string) => void;
  setObservations: (updates: Partial<ObservationChecklist>) => void;
  setOGSScore: (leftScore: OGSScore, rightScore: OGSScore) => void;
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
    set(({ session }) => ({
      session: {
        ...session,
        quality: { ...session.quality, ...updates },
      },
    })),

  setDuration: (durationSeconds) =>
    set(({ session }) => ({
      session: {
        ...session,
        quality: { ...session.quality, durationSeconds },
      },
    })),

  addHeelStrike: (foot, timestamp, source = 'manual', confidence = null) =>
    set(({ session }) => {
      const sanitizedTimestamp = Number.isFinite(timestamp)
        ? Math.max(0, Number.parseFloat(timestamp.toFixed(2)))
        : 0;
      const DEDUP_S = 0.12;
      if (source === 'auto') {
        const dup = session.events.find(
          (e) =>
            e.type === 'heel_strike' &&
            e.foot === foot &&
            e.source === 'auto' &&
            Math.abs(e.timestamp - sanitizedTimestamp) < DEDUP_S,
        );
        if (dup) {
          return { session };
        }
      }
      const id = crypto.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const resolvedConfidence =
        confidence != null && Number.isFinite(confidence)
          ? Math.min(1, Math.max(0, confidence))
          : source === 'manual'
            ? 0.7
            : 0.5;
      const newEvent: GaitEvent = {
        id,
        foot,
        timestamp: sanitizedTimestamp,
        type: 'heel_strike',
        source,
        confidence: resolvedConfidence,
      };
      return {
        session: {
          ...session,
          events: [...session.events, newEvent].sort((a, b) => a.timestamp - b.timestamp),
        },
      };
    }),

  syncOfflineAutoHeelStrikes: (strikes) =>
    set(({ session }) => {
      const DEDUP_S = 0.12;
      const manual = session.events.filter((e) => !(e.source === 'auto' && e.type === 'heel_strike'));
      const sorted = [...strikes].sort((a, b) => a.timestamp - b.timestamp);
      const deduped: HeelStrikeEvent[] = [];
      for (const s of sorted) {
        const prev = deduped[deduped.length - 1];
        if (prev && prev.foot === s.foot && Math.abs(s.timestamp - prev.timestamp) < DEDUP_S) {
          continue;
        }
        deduped.push(s);
      }
      const newAutoEvents: GaitEvent[] = deduped.map((s) => ({
        id: crypto.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        foot: s.foot,
        timestamp: Number.isFinite(s.timestamp) ? Math.max(0, Number.parseFloat(s.timestamp.toFixed(2))) : 0,
        type: 'heel_strike' as const,
        source: 'auto' as const,
        confidence: Math.min(1, Math.max(0, s.confidence)),
      }));
      return {
        session: {
          ...session,
          events: [...manual, ...newAutoEvents].sort((a, b) => a.timestamp - b.timestamp),
        },
      };
    }),

  syncDetectedGaitEvents: (events) =>
    set(({ session }) => {
      const DEDUP_S = 0.12;
      const manual = session.events.filter((e) => e.source !== 'auto');
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

      const autoEvents: GaitEvent[] = deduped.map((event) => ({
        id: crypto.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        foot: event.foot,
        timestamp: Number.isFinite(event.timestamp) ? Math.max(0, Number.parseFloat(event.timestamp.toFixed(2))) : 0,
        type: event.type,
        source: 'auto',
        confidence: Math.min(1, Math.max(0, event.confidence ?? 0.5)),
      }));

      return {
        session: {
          ...session,
          events: [...manual, ...autoEvents].sort((a, b) => a.timestamp - b.timestamp),
        },
      };
    }),

  clearGaitEvents: () =>
    set(({ session }) => ({
      session: {
        ...session,
        events: [],
      },
    })),

  updateEvent: (eventId, updates) =>
    set(({ session }) => ({
      session: {
        ...session,
        events: session.events
          .map((event) => (event.id === eventId ? { ...event, ...updates } : event))
          .sort((a, b) => a.timestamp - b.timestamp),
      },
    })),

  removeEvent: (eventId) =>
    set(({ session }) => ({
      session: {
        ...session,
        events: session.events.filter((event) => event.id !== eventId),
      },
    })),

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

  finalizeAnalysis: async () => {
    const { session } = get();

    // Basic analysis (for backward compatibility)
    const metrics = computeMetrics({
      events: session.events,
      distanceMeters: session.captureSettings.distanceMeters,
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

    // Enhanced analysis if pose data is available
    if (session.poseFrames && session.poseFrames.length > 0) {
      try {
        const analysisPayload = {
          events: session.events,
          captureSettings: session.captureSettings,
          quality: session.quality,
          observations: session.observations,
          poseFrames: session.poseFrames,
          ogs: session.ogs ?? undefined,
          patient: {
            identifier: session.patient?.identifier ?? 'N/A',
            age: session.patient?.age,
          },
        };
        const { result: enhancedResult, medReport } = await runAnalysisWithWorkerFallback(analysisPayload);

        const analyzer = new EnhancedGaitAnalyzer();
        const detectedEvents = enhancedResult.detectedGaitCycles?.flatMap((cycle) => cycle.events) ?? [];
        get().syncDetectedGaitEvents(detectedEvents);
        const updatedSession = get().session;
        const recomputedMetrics = computeMetrics({
          events: updatedSession.events,
          distanceMeters: updatedSession.captureSettings.distanceMeters,
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

        set(({ session: current }) => ({
          session: {
            ...current,
            metrics: recomputedMetrics,
            patternFlags: enhancedResult.combinedPatterns,
            report: {
              ...recomputedReport,
              notes: enhancedReport.summary,
            },
            advancedMetrics: enhancedResult.advancedMetrics,
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
          },
        }));
      } catch (error) {
        console.error('Enhanced analysis failed, falling back to basic analysis:', error);

        set(({ session: current }) => ({
          session: {
            ...current,
            metrics,
            patternFlags,
            report,
            clinicalAnalysisSnapshot: undefined,
            enhancedAnalysisResult: undefined,
            advancedMetrics: undefined,
          },
        }));
      }
    } else {
      set(({ session: current }) => ({
        session: {
          ...current,
          metrics,
          patternFlags,
          report,
          clinicalAnalysisSnapshot: undefined,
        },
      }));
    }
  },

  performEnhancedAnalysis: async () => {
    const { session } = get();

    if (!session.poseFrames || session.poseFrames.length === 0) {
      console.warn('No pose frames available for enhanced analysis');
      return;
    }

    try {
      const { result } = await runAnalysisWithWorkerFallback({
        events: session.events,
        captureSettings: session.captureSettings,
        quality: session.quality,
        observations: session.observations,
        poseFrames: session.poseFrames,
        ogs: session.ogs ?? undefined,
        patient: {
          identifier: session.patient?.identifier ?? 'N/A',
          age: session.patient?.age,
        },
      });

      set(({ session: current }) => ({
        session: {
          ...current,
          advancedMetrics: result.advancedMetrics,
          enhancedAnalysisResult: result,
        },
      }));
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

