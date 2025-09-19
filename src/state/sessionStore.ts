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
} from '../types/session.ts';
import { computeMetrics } from '../lib/metrics.ts';
import { evaluatePatterns } from '../lib/patterns.ts';
import { buildReport } from '../lib/report.ts';

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
  patient: undefined,
  videoBlob: undefined,
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
  finalizeAnalysis: () => void;
  setVideoBlob: (blob: Blob | undefined) => void;
  setPatientInfo: (updates: Partial<NonNullable<SessionData['patient']>>) => void;
  setReportSummary: (updates: Partial<ReportSummary>) => void;
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

  finalizeAnalysis: () => {
    const { session } = get();

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

    set(({ session: current }) => ({
      session: {
        ...current,
        metrics,
        patternFlags,
        report,
      },
    }));
  },

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
}));
