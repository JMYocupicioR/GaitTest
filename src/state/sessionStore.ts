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
import type { PoseFrame } from '../lib/poseEstimation.ts';

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
  createdAtIso: new Date().toISOString(),
  captureSettings: {
    viewMode: 'lateral',
    calibrationType: 'line',
    distanceMeters: 5,
    targetFps: 60,
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
  addHeelStrike: (foot: 'L' | 'R', timestamp: number, source?: GaitEvent['source']) => void;
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

  addHeelStrike: (foot, timestamp, source = 'manual') =>
    set(({ session }) => {
      const sanitizedTimestamp = Number.isFinite(timestamp)
        ? Math.max(0, Number.parseFloat(timestamp.toFixed(2)))
        : 0;
      const id = crypto.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newEvent: GaitEvent = {
        id,
        foot,
        timestamp: sanitizedTimestamp,
        type: 'heel_strike',
        source,
        confidence: source === 'manual' ? 0.7 : 0.5,
      };
      return {
        session: {
          ...session,
          events: [...session.events, newEvent].sort((a, b) => a.timestamp - b.timestamp),
        },
      };
    }),

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
        const analyzer = new EnhancedGaitAnalyzer();
        const enhancedResult = await analyzer.performCompleteAnalysis({
          events: session.events,
          captureSettings: session.captureSettings,
          quality: session.quality,
          observations: session.observations,
          poseFrames: session.poseFrames,
        });

        const enhancedReport = analyzer.generateEnhancedReport(enhancedResult);

        // Update OGS analysis with enhanced data if available
        let updatedOGS = session.ogs;
        if (session.ogs && enhancedResult.advancedMetrics) {
          updatedOGS = ogsAnalyzer.calculateOGSFinalScore(
            session.ogs.leftScore!,
            session.ogs.rightScore!,
            session,
            enhancedResult.advancedMetrics,
            undefined, // kinematicSummary - not available in EnhancedAnalysisResult
            undefined  // compensationAnalysis - not available in EnhancedAnalysisResult
          );
        }

        set(({ session: current }) => ({
          session: {
            ...current,
            metrics,
            patternFlags: enhancedResult.combinedPatterns,
            report: {
              ...report,
              notes: enhancedReport.summary,
            },
            advancedMetrics: enhancedResult.advancedMetrics,
            enhancedAnalysisResult: enhancedResult,
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
      const analyzer = new EnhancedGaitAnalyzer();
      const result = await analyzer.performCompleteAnalysis({
        events: session.events,
        captureSettings: session.captureSettings,
        quality: session.quality,
        observations: session.observations,
        poseFrames: session.poseFrames,
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
      // Initialize database if needed
      await DataService.initializeDatabase();

      // Save session data
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
