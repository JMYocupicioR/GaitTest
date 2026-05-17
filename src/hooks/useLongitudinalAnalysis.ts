import { useState, useCallback, useEffect } from 'react';
import { LongitudinalAnalyzer } from '../lib/longitudinalAnalysis.ts';
import type { SessionComparison, LongitudinalReport, TrendAnalysis } from '../lib/longitudinalAnalysis.ts';
import type { AdvancedMetrics, SessionData } from '../types/session.ts';
import type { SessionRecord } from '../lib/supabase.ts';
import { DataService } from '../services/dataService.ts';

export interface UseLongitudinalAnalysisOptions {
  patientId?: string;
  autoLoad?: boolean;
}

export const useLongitudinalAnalysis = (options: UseLongitudinalAnalysisOptions = {}) => {
  const [analyzer] = useState(() => new LongitudinalAnalyzer());
  const [sessions, setSessions] = useState<SessionComparison[]>([]);
  const [report, setReport] = useState<LongitudinalReport | null>(null);
  const [trends, setTrends] = useState<TrendAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapSessionRecord = useCallback((session: SessionRecord): SessionComparison => {
    const sourceMetrics = session.session_data?.metrics ?? {};
    const patterns = Array.isArray(session.session_data?.patternFlags)
      ? session.session_data.patternFlags.map((flag: { label?: string }) => flag.label ?? 'Sin etiqueta')
      : [];

    return {
      sessionId: session.exam_id,
      date: session.session_date,
      metrics: sourceMetrics as AdvancedMetrics,
      riskScore: calculateRiskScoreFromRecord(session),
      patternsSummary: patterns,
    };
  }, []);

  const loadSessions = useCallback(async (patientId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const remoteSessions = await DataService.getPatientSessions(patientId);
      if (!remoteSessions.length) {
        setSessions([]);
        setTrends([]);
        setReport(null);
        return;
      }

      const sessionComparisons = remoteSessions.map(mapSessionRecord);
      setSessions(sessionComparisons);

      if (sessionComparisons.length >= 3) {
        const trendAnalyses = analyzer.analyzeTrends(sessionComparisons);
        setTrends(trendAnalyses);

        const longitudinalReport = analyzer.generateLongitudinalReport(patientId, sessionComparisons);
        setReport(longitudinalReport);
      } else {
        setTrends([]);
        setReport(null);
      }
    } catch (err) {
      setError(`Error loading sessions: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [analyzer, mapSessionRecord]);

  // Save session to Supabase and refresh longitudinal analysis
  const saveSession = useCallback(async (sessionData: SessionData, patientId: string) => {
    try {
      const nextSession: SessionData = {
        ...sessionData,
        patient: {
          ...sessionData.patient,
          identifier: patientId,
        },
      };
      const sessionId = await DataService.saveSession(nextSession);
      if (!sessionId) {
        throw new Error('No se pudo guardar la sesion en Supabase');
      }
      await loadSessions(patientId);
    } catch (err) {
      setError(`Error saving session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [loadSessions]);

  // Compare two specific sessions
  const compareSessions = useCallback((sessionId1: string, sessionId2: string): {
    session1: SessionComparison | null;
    session2: SessionComparison | null;
    improvements: string[];
    declines: string[];
    unchanged: string[];
  } => {
    const session1 = sessions.find(s => s.sessionId === sessionId1);
    const session2 = sessions.find(s => s.sessionId === sessionId2);

    if (!session1 || !session2) {
      return {
        session1: session1 || null,
        session2: session2 || null,
        improvements: [],
        declines: [],
        unchanged: []
      };
    }

    const improvements: string[] = [];
    const declines: string[] = [];
    const unchanged: string[] = [];

    const metricsToCompare = [
      'speedMps',
      'cadenceSpm',
      'stepLengthMeters',
      'stanceAsymmetryPct',
      'stepTimeVariability',
      'harmonicRatio'
    ];

    metricsToCompare.forEach(metric => {
      const value1 = session1.metrics[metric as keyof typeof session1.metrics] as number;
      const value2 = session2.metrics[metric as keyof typeof session2.metrics] as number;

      if (value1 && value2) {
        const changePercent = ((value2 - value1) / value1) * 100;

        if (Math.abs(changePercent) < 5) {
          unchanged.push(`${metric}: sin cambios significativos`);
        } else {
          // For some metrics, increase is good, for others decrease is good
          const improvingWithIncrease = ['speedMps', 'harmonicRatio'];
          const isImprovement = improvingWithIncrease.includes(metric) ?
            changePercent > 0 : changePercent < 0;

          if (isImprovement) {
            improvements.push(`${metric}: mejora del ${Math.abs(changePercent).toFixed(1)}%`);
          } else {
            declines.push(`${metric}: decline del ${Math.abs(changePercent).toFixed(1)}%`);
          }
        }
      }
    });

    return {
      session1,
      session2,
      improvements,
      declines,
      unchanged
    };
  }, [sessions]);

  // Get trend for specific parameter
  const getTrendForParameter = useCallback((parameter: string): TrendAnalysis | null => {
    return trends.find(trend => trend.parameter === parameter) || null;
  }, [trends]);

  // Export longitudinal data
  const exportLongitudinalData = useCallback(() => {
    if (!report) return null;

    const exportData = {
      report,
      sessions: sessions.map(session => ({
        ...session,
        metrics: session.metrics
      })),
      trends,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gait_longitudinal_${options.patientId || 'patient'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return exportData;
  }, [report, sessions, trends, options.patientId]);

  // Auto-load sessions on mount
  useEffect(() => {
    if (options.autoLoad && options.patientId) {
      loadSessions(options.patientId);
    }
  }, [options.autoLoad, options.patientId, loadSessions]);

  return {
    sessions,
    report,
    trends,
    isLoading,
    error,
    loadSessions,
    saveSession,
    compareSessions,
    getTrendForParameter,
    exportLongitudinalData,
    hasEnoughDataForTrends: sessions.length >= 3
  };
};

function calculateRiskScoreFromRecord(session: SessionRecord): number {
  let risk = 0;
  const metrics = session.session_data?.metrics ?? {};
  const patternFlags = Array.isArray(session.session_data?.patternFlags) ? session.session_data.patternFlags : [];
  const quality = session.session_data?.quality;

  if (metrics.speedMps && metrics.speedMps < 1.0) {
    risk += 30;
  }

  if (metrics.stanceAsymmetryPct && metrics.stanceAsymmetryPct > 10) {
    risk += 25;
  }

  if (patternFlags.some((flag: { status?: string }) => flag.status === 'likely')) {
    risk += 20;
  }

  if (quality?.confidence === 'low') {
    risk += 10;
  }

  return Math.min(100, risk);
}