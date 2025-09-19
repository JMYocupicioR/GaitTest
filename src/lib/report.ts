import type { CaptureQuality, PatternFlag, ReportSummary, SessionMetrics } from '../types/session.ts';

interface BuildReportInput {
  metrics: SessionMetrics;
  patternFlags: PatternFlag[];
  quality: CaptureQuality;
}

export const buildReport = ({ metrics, patternFlags, quality }: BuildReportInput): ReportSummary => {
  const notes: string[] = [];

  if (!metrics.speedMps || !metrics.cadenceSpm) {
    notes.push('Repetir captura si es posible para obtener velocidad y cadencia confiables.');
  }

  if (quality.confidence === 'low' || quality.issues.length > 0) {
    notes.push('Calidad del video limitada: ' + quality.issues.join(', '));
  }

  const concerningFlags = patternFlags.filter((flag) => flag.status === 'likely');
  const possibleFlags = patternFlags.filter((flag) => flag.status === 'possible');

  const speed = metrics.speedMps ?? 0;
  if (speed > 0 && speed < 0.8) {
    notes.push('Velocidad inferior a 0.8 m/s: considerar valoración funcional.');
  }

  const cadence = metrics.cadenceSpm ?? 0;
  if (cadence > 0 && cadence < 90) {
    notes.push('Cadencia baja (<90 pasos/min) comparada con adultos sanos.');
  }

  const asym = metrics.stanceAsymmetryPct ?? 0;
  if (asym >= 15) {
    notes.push('Asimetría de apoyo marcada (>15%).');
  }

  let trafficLight: ReportSummary['trafficLight'] = 'green';
  if (concerningFlags.length > 0 || asym >= 15) {
    trafficLight = 'red';
  } else if (possibleFlags.length > 0 || quality.confidence === 'medium' || quality.issues.length > 0) {
    trafficLight = 'yellow';
  }

  if (trafficLight === 'green' && notes.length === 0) {
    notes.push('Métricas dentro de rangos orientativos. Mantener seguimiento habitual.');
  }

  return {
    trafficLight,
    notes: notes.join(' '),
    pdfUrl: null,
  };
};
