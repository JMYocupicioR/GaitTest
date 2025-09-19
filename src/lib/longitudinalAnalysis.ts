import type { AdvancedMetrics } from '../types/session.ts';

export interface SessionComparison {
  sessionId: string;
  date: string;
  metrics: AdvancedMetrics;
  riskScore: number;
  patternsSummary: string[];
}

export interface TrendAnalysis {
  parameter: string;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  changePercent: number;
  significance: 'high' | 'medium' | 'low';
  description: string;
  dataPoints: Array<{
    date: string;
    value: number;
  }>;
}

export interface LongitudinalReport {
  patientId: string;
  analysisDate: string;
  totalSessions: number;
  timeSpanDays: number;
  overallTrend: 'improving' | 'declining' | 'stable';
  keyFindings: string[];
  trendAnalyses: TrendAnalysis[];
  alerts: AlertMessage[];
  recommendations: string[];
}

export interface AlertMessage {
  type: 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  timestamp: string;
}

export class LongitudinalAnalyzer {
  private readonly MINIMUM_SESSIONS = 3;
  private readonly SIGNIFICANT_CHANGE_THRESHOLD = 15; // 15% change
  private readonly CRITICAL_DECLINE_THRESHOLD = 30; // 30% decline

  public analyzeTrends(sessions: SessionComparison[]): TrendAnalysis[] {
    if (sessions.length < this.MINIMUM_SESSIONS) {
      return [];
    }

    const sortedSessions = sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const analyses: TrendAnalysis[] = [];

    // Key parameters to track
    const parametersToTrack = [
      'speedMps',
      'cadenceSpm',
      'stepLengthMeters',
      'stanceAsymmetryPct',
      'stepTimeVariability',
      'harmonicRatio',
      'gaitSymmetryIndex',
      'lateralStability'
    ];

    parametersToTrack.forEach(param => {
      const analysis = this.analyzeSingleParameter(param, sortedSessions);
      if (analysis) {
        analyses.push(analysis);
      }
    });

    return analyses;
  }

  private analyzeSingleParameter(parameter: string, sessions: SessionComparison[]): TrendAnalysis | null {
    const dataPoints = sessions
      .map(session => ({
        date: session.date,
        value: session.metrics[parameter as keyof AdvancedMetrics] as number
      }))
      .filter(point => point.value !== null && point.value !== undefined && !isNaN(point.value));

    if (dataPoints.length < this.MINIMUM_SESSIONS) {
      return {
        parameter,
        trend: 'insufficient_data',
        changePercent: 0,
        significance: 'low',
        description: `Insuficientes datos para analizar tendencia de ${parameter}`,
        dataPoints: []
      };
    }

    // Linear regression for trend analysis
    const { rSquared } = this.calculateLinearRegression(dataPoints);
    const firstValue = dataPoints[0].value;
    const lastValue = dataPoints[dataPoints.length - 1].value;
    const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    // Determine trend direction
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      // For some parameters, increase is good, for others decrease is good
      const improvingParameters = ['speedMps', 'harmonicRatio', 'lateralStability'];
      const decliningIsBad = improvingParameters.includes(parameter);

      if (changePercent > 0) {
        trend = decliningIsBad ? 'improving' : 'declining';
      } else {
        trend = decliningIsBad ? 'declining' : 'improving';
      }
    }

    // Determine significance
    let significance: 'high' | 'medium' | 'low' = 'low';
    if (rSquared > 0.7 && Math.abs(changePercent) > this.SIGNIFICANT_CHANGE_THRESHOLD) {
      significance = 'high';
    } else if (rSquared > 0.5 && Math.abs(changePercent) > 10) {
      significance = 'medium';
    }

    const description = this.generateTrendDescription(parameter, trend, changePercent, significance);

    return {
      parameter,
      trend,
      changePercent,
      significance,
      description,
      dataPoints
    };
  }

  private calculateLinearRegression(points: Array<{ date: string; value: number }>): { slope: number; rSquared: number } {
    const n = points.length;

    const x = points.map((_, i) => i); // Use index as x for simplicity
    const y = points.map(p => p.value);

    const sumX = x.reduce((sum, xi) => sum + xi, 0);
    const sumY = y.reduce((sum, yi) => sum + yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);

    const rSquared = 1 - (residualSumSquares / totalSumSquares);

    return { slope, rSquared: Math.max(0, rSquared) };
  }

  private generateTrendDescription(parameter: string, trend: string, changePercent: number, significance: string): string {
    const paramNames: { [key: string]: string } = {
      speedMps: 'velocidad de marcha',
      cadenceSpm: 'cadencia',
      stepLengthMeters: 'longitud de paso',
      stanceAsymmetryPct: 'asimetría de apoyo',
      stepTimeVariability: 'variabilidad temporal',
      harmonicRatio: 'suavidad del movimiento',
      gaitSymmetryIndex: 'índice de simetría',
      lateralStability: 'estabilidad lateral'
    };

    const paramName = paramNames[parameter] || parameter;
    const changeAbs = Math.abs(changePercent).toFixed(1);

    if (trend === 'improving') {
      return `${paramName} muestra mejora del ${changeAbs}% (${significance} significancia)`;
    } else if (trend === 'declining') {
      return `${paramName} muestra deterioro del ${changeAbs}% (${significance} significancia)`;
    } else {
      return `${paramName} se mantiene estable con variación del ${changeAbs}%`;
    }
  }

  public generateAlerts(trendAnalyses: TrendAnalysis[], latestSession: SessionComparison): AlertMessage[] {
    const alerts: AlertMessage[] = [];
    const now = new Date().toISOString();

    // Critical decline alerts
    const criticalDeclines = trendAnalyses.filter(
      analysis => analysis.trend === 'declining' &&
      analysis.significance === 'high' &&
      Math.abs(analysis.changePercent) > this.CRITICAL_DECLINE_THRESHOLD
    );

    criticalDeclines.forEach(analysis => {
      alerts.push({
        type: 'critical',
        title: 'Deterioro Significativo Detectado',
        message: `${analysis.parameter}: declive del ${Math.abs(analysis.changePercent).toFixed(1)}%. Evaluación clínica recomendada.`,
        timestamp: now
      });
    });

    // High fall risk alert
    if (latestSession.riskScore > 70) {
      alerts.push({
        type: 'warning',
        title: 'Alto Riesgo de Caídas',
        message: `Riesgo de caídas elevado (${latestSession.riskScore}%). Considerar intervención inmediata.`,
        timestamp: now
      });
    }

    // Improvement recognition
    const significantImprovements = trendAnalyses.filter(
      analysis => analysis.trend === 'improving' &&
      analysis.significance === 'high' &&
      Math.abs(analysis.changePercent) > 20
    );

    if (significantImprovements.length > 0) {
      alerts.push({
        type: 'info',
        title: 'Mejora Significativa',
        message: `Se observan mejoras notables en ${significantImprovements.length} parámetros. Continuar con el plan actual.`,
        timestamp: now
      });
    }

    // Data quality alerts
    const insufficientData = trendAnalyses.filter(analysis => analysis.trend === 'insufficient_data');
    if (insufficientData.length > 3) {
      alerts.push({
        type: 'info',
        title: 'Datos Insuficientes',
        message: 'Se requieren más sesiones para un análisis longitudinal completo.',
        timestamp: now
      });
    }

    return alerts;
  }

  public generateRecommendations(
    trendAnalyses: TrendAnalysis[],
    alerts: AlertMessage[]
  ): string[] {
    const recommendations: string[] = [];

    // Based on declining trends
    const decliningParameters = trendAnalyses.filter(a => a.trend === 'declining' && a.significance !== 'low');

    if (decliningParameters.some(p => p.parameter === 'speedMps')) {
      recommendations.push('Considerar entrenamiento de resistencia y fortalecimiento de miembros inferiores.');
    }

    if (decliningParameters.some(p => p.parameter === 'harmonicRatio' || p.parameter === 'lateralStability')) {
      recommendations.push('Ejercicios de equilibrio y coordinación recomendados.');
    }

    if (decliningParameters.some(p => p.parameter === 'stanceAsymmetryPct')) {
      recommendations.push('Evaluación ortopédica para descartar causas estructurales de asimetría.');
    }

    if (decliningParameters.some(p => p.parameter === 'stepTimeVariability')) {
      recommendations.push('Ejercicios de ritmo y coordinación temporal.');
    }

    // Based on alerts
    if (alerts.some(a => a.type === 'critical')) {
      recommendations.push('Derivación urgente a especialista en medicina física y rehabilitación.');
    }

    if (alerts.some(a => a.title.includes('Alto Riesgo'))) {
      recommendations.push('Implementar medidas de prevención de caídas en el hogar.');
      recommendations.push('Considerar uso de ayudas técnicas para la marcha.');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Mantener actividad física regular y seguimiento periódico.');
    }

    recommendations.push('Programar próxima evaluación en 4-6 semanas para monitoreo continuo.');

    return recommendations;
  }

  public generateLongitudinalReport(
    patientId: string,
    sessions: SessionComparison[]
  ): LongitudinalReport {
    if (sessions.length === 0) {
      throw new Error('No hay sesiones disponibles para el análisis');
    }

    const sortedSessions = sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstDate = new Date(sortedSessions[0].date);
    const lastDate = new Date(sortedSessions[sortedSessions.length - 1].date);
    const timeSpanDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    const trendAnalyses = this.analyzeTrends(sessions);
    const latestSession = sortedSessions[sortedSessions.length - 1];
    const alerts = this.generateAlerts(trendAnalyses, latestSession);
    const recommendations = this.generateRecommendations(trendAnalyses, alerts);

    // Determine overall trend
    const significantTrends = trendAnalyses.filter(a => a.significance !== 'low');
    const improvingCount = significantTrends.filter(a => a.trend === 'improving').length;
    const decliningCount = significantTrends.filter(a => a.trend === 'declining').length;

    let overallTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (improvingCount > decliningCount + 1) {
      overallTrend = 'improving';
    } else if (decliningCount > improvingCount + 1) {
      overallTrend = 'declining';
    }

    // Generate key findings
    const keyFindings: string[] = [];
    const mostSignificantTrend = trendAnalyses
      .filter(a => a.significance === 'high')
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];

    if (mostSignificantTrend) {
      keyFindings.push(mostSignificantTrend.description);
    }

    if (alerts.some(a => a.type === 'critical')) {
      keyFindings.push('Se detectaron cambios críticos que requieren atención médica inmediata.');
    }

    if (overallTrend === 'improving') {
      keyFindings.push('Tendencia general de mejora en los parámetros de marcha.');
    } else if (overallTrend === 'declining') {
      keyFindings.push('Tendencia general de deterioro en los parámetros de marcha.');
    }

    return {
      patientId,
      analysisDate: new Date().toISOString(),
      totalSessions: sessions.length,
      timeSpanDays,
      overallTrend,
      keyFindings,
      trendAnalyses,
      alerts,
      recommendations
    };
  }
}