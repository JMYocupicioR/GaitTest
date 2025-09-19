import { useState, useCallback, useEffect } from 'react';
import { LongitudinalAnalyzer } from '../lib/longitudinalAnalysis.ts';
import type { SessionComparison, LongitudinalReport, TrendAnalysis } from '../lib/longitudinalAnalysis.ts';
import type { SessionData, AdvancedMetrics } from '../types/session.ts';

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

  // Load sessions from localStorage or indexedDB
  const loadSessions = useCallback(async (patientId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real app, this would load from a database
      const storedSessions = localStorage.getItem(`gait_sessions_${patientId}`);

      if (storedSessions) {
        const parsedSessions: SessionData[] = JSON.parse(storedSessions);

        const sessionComparisons: SessionComparison[] = parsedSessions.map(session => ({
          sessionId: session.sessionId,
          date: session.createdAtIso,
          metrics: session.metrics as AdvancedMetrics, // Type assertion for AdvancedMetrics
          riskScore: calculateRiskScore(session),
          patternsSummary: session.patternFlags.map(flag => flag.label)
        }));

        setSessions(sessionComparisons);

        if (sessionComparisons.length >= 3) {
          const trendAnalyses = analyzer.analyzeTrends(sessionComparisons);
          setTrends(trendAnalyses);

          const longitudinalReport = analyzer.generateLongitudinalReport(patientId, sessionComparisons);
          setReport(longitudinalReport);
        }
      } else {
        setSessions([]);
        setTrends([]);
        setReport(null);
      }
    } catch (err) {
      setError(`Error loading sessions: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [analyzer]);

  // Save session to storage
  const saveSession = useCallback(async (sessionData: SessionData, patientId: string) => {
    try {
      const storedSessions = localStorage.getItem(`gait_sessions_${patientId}`);
      const existingSessions: SessionData[] = storedSessions ? JSON.parse(storedSessions) : [];

      // Update existing session or add new one
      const sessionIndex = existingSessions.findIndex(s => s.sessionId === sessionData.sessionId);
      if (sessionIndex >= 0) {
        existingSessions[sessionIndex] = sessionData;
      } else {
        existingSessions.push(sessionData);
      }

      // Sort by date and keep last 50 sessions
      existingSessions.sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime());
      const limitedSessions = existingSessions.slice(0, 50);

      localStorage.setItem(`gait_sessions_${patientId}`, JSON.stringify(limitedSessions));

      // Reload analysis
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

// Helper function to calculate risk score from session data
function calculateRiskScore(session: SessionData): number {
  let risk = 0;

  if (session.metrics.speedMps && session.metrics.speedMps < 1.0) {
    risk += 30;
  }

  if (session.metrics.stanceAsymmetryPct && session.metrics.stanceAsymmetryPct > 10) {
    risk += 25;
  }

  if (session.patternFlags.some(flag => flag.status === 'likely')) {
    risk += 20;
  }

  if (session.quality.confidence === 'low') {
    risk += 10;
  }

  return Math.min(100, risk);
}