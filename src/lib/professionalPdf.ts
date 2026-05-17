/**
 * Professional Clinical Gait Analysis PDF Report
 *
 * Multi-page PDF with embedded charts and stick-figure gait phase illustrations.
 * Uses jsPDF with Canvas-rendered images for visual richness.
 *
 * Layout:
 *   Page 1 — Header, executive summary, risk gauge, spatiotemporal chart
 *   Page 2 — Gait phase strip (8 stick figures), OGS radar
 *   Page 3 — Kinematic curves (hip, knee, ankle) with normative bands
 *   Page 4 — Clinical findings, pathology, recommendations, follow-up, references
 */

import jsPDF from 'jspdf';
import type { SessionData } from '../types/session.ts';
import { renderGaitPhaseStripToDataURL } from './gaitPhaseRenderer.ts';
import {
  renderAllKinematicCharts,
  renderSpatiotemporalChart,
  renderRiskGauge,
  renderOGSRadar,
} from './reportCharts.ts';
import { renderPhaseHeatmap, renderSymmetryRadarChart, renderVisibilityTrend } from './advancedCharts.ts';
import { buildSymmetryRadar } from './symmetryRadar.ts';
import { MedicalReportGenerator } from './medicalReporting.ts';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PAGE_WIDTH = 595.28;  // A4 pt
const PAGE_HEIGHT = 841.89;
const M = 40; // margin
const CONTENT_W = PAGE_WIDTH - 2 * M;
const FONT = 'helvetica';

const COLORS = {
  primary: '#1e3a5f',
  accent: '#2563eb',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  bgLight: '#f8fafc',
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function addHeader(doc: jsPDF, title: string) {
  // Top accent bar
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_WIDTH, 6, 'F');

  // Title
  doc.setFont(FONT, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary);
  doc.text(title, PAGE_WIDTH / 2, 28, { align: 'center' });

  // Accent line
  doc.setDrawColor(COLORS.accent);
  doc.setLineWidth(1.5);
  doc.line(M, 34, PAGE_WIDTH - M, 34);
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = PAGE_HEIGHT - 25;

  // Bottom accent bar
  doc.setFillColor(30, 58, 95);
  doc.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8, 'F');

  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLORS.muted);
  doc.text(
    'INFORME GENERADO POR GAIT ANALYSIS · DEEPLUXMED · USO CLÍNICO CONFIDENCIAL',
    M, y,
  );
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH - M, y,
    { align: 'right' },
  );

  doc.setFontSize(6);
  doc.text(
    'Este reporte es un apoyo al diagnóstico clínico. Los hallazgos deben ser interpretados por un profesional de la salud cualificado.',
    PAGE_WIDTH / 2, y + 8,
    { align: 'center' },
  );
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(COLORS.primary);
  doc.text(title, M, y);

  doc.setDrawColor(COLORS.accent);
  doc.setLineWidth(0.8);
  doc.line(M, y + 3, M + CONTENT_W, y + 3);

  return y + 14;
}

function addText(doc: jsPDF, text: string, y: number, options?: { bold?: boolean; size?: number; color?: string; indent?: number }): number {
  const { bold = false, size = 9, color = COLORS.text, indent = 0 } = options ?? {};
  doc.setFont(FONT, bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color);
  const lines = doc.splitTextToSize(text, CONTENT_W - indent);
  doc.text(lines, M + indent, y);
  return y + lines.length * (size * 1.3);
}

function addBullet(doc: jsPDF, text: string, y: number, bulletColor?: string): number {
  doc.setFillColor(bulletColor ?? COLORS.accent);
  doc.circle(M + 4, y - 2, 1.5, 'F');
  return addText(doc, text, y, { indent: 12 });
}

function addKeyValue(doc: jsPDF, key: string, value: string, y: number): number {
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.muted);
  doc.text(key + ':', M, y);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(COLORS.text);
  doc.text(value, M + 100, y);
  return y + 13;
}

function trafficLightEmoji(light: 'green' | 'yellow' | 'red'): string {
  switch (light) {
    case 'green': return '●  RIESGO BAJO';
    case 'yellow': return '●  RIESGO MODERADO';
    case 'red': return '●  RIESGO ALTO';
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Build a professional multi-page PDF report.
 */
export function buildProfessionalPdf(session: SessionData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const totalPages = 5;

  // Extract data
  const metrics = session.metrics;
  const advMetrics = session.advancedMetrics;
  const enhancedResult = session.enhancedAnalysisResult as (typeof session.enhancedAnalysisResult & {
    compensationAnalysis?: unknown;
    frontalMetrics?: unknown;
    cycleAnalysis?: unknown;
    detectedGaitCycles?: unknown[];
    detailedKinematics?: unknown;
  }) | undefined;
  const kinSummary = enhancedResult?.kinematicSummary;
  const ogs = session.ogs;

  // Generate medical report data
  const reportGen = new MedicalReportGenerator();
  const medReport = reportGen.generateComprehensiveReport(
    advMetrics ?? (metrics as unknown as import('../types/session.ts').AdvancedMetrics),
    kinSummary,
    enhancedResult?.compensationAnalysis as import('./compensationDetection.ts').CompensationAnalysis | undefined,
    enhancedResult?.frontalMetrics as import('./frontalAnalysis.ts').FrontalMetrics | undefined,
    enhancedResult?.cycleAnalysis as import('./gaitCycleAnalysis.ts').GaitCycleComparison | undefined,
    enhancedResult?.detectedGaitCycles as import('./advancedEventDetection.ts').GaitCycle[] | undefined,
    enhancedResult?.detailedKinematics,
    ogs ?? undefined,
    {
      identifier: session.patient?.identifier ?? 'N/A',
      age: session.patient?.age,
    },
  );

  // ═════════════════════════════════════════════════════════════
  // PAGE 1: Header & Executive Summary
  // ═════════════════════════════════════════════════════════════

  addHeader(doc, 'INFORME DE ANÁLISIS DE MARCHA');
  let y = 46;

  // Patient info box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(M, y, CONTENT_W, 60, 4, 4, 'F');
  y += 14;
  y = addKeyValue(doc, 'Paciente', session.patient?.name || 'No especificado', y);
  y = addKeyValue(doc, 'Identificador', session.patient?.identifier || 'N/A', y);
  y = addKeyValue(doc, 'Fecha', new Date(session.createdAtIso).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), y);
  y = addKeyValue(doc, 'Vista de captura', session.captureSettings.viewMode === 'lateral' ? 'Lateral' : 'Frontal', y);
  y += 8;

  // Risk traffic light
  const tlColor = session.report.trafficLight === 'green' ? COLORS.green
    : session.report.trafficLight === 'yellow' ? COLORS.yellow
    : COLORS.red;

  doc.setFillColor(tlColor);
  doc.circle(M + 8, y + 4, 6, 'F');
  y = addText(doc, trafficLightEmoji(session.report.trafficLight), y, { bold: true, size: 12, indent: 20 });
  y += 4;

  // Executive summary
  y = addSectionTitle(doc, '1. Resumen Ejecutivo', y);
  y = addText(doc, medReport.clinicalFindings.overallSummary, y);
  y += 4;
  y = addText(doc, `Diagnóstico principal: ${medReport.clinicalImpression.primaryDiagnosis}`, y, { bold: true });
  y = addText(doc, `Severidad: ${medReport.clinicalImpression.severity} · Pronóstico: ${medReport.clinicalImpression.prognosis}`, y);
  y += 8;

  // Key metrics
  y = addSectionTitle(doc, '2. Métricas Clave', y);
  y = addKeyValue(doc, 'Velocidad', `${(metrics.speedMps ?? 0).toFixed(2)} m/s`, y);
  y = addKeyValue(doc, 'Cadencia', `${(metrics.cadenceSpm ?? 0).toFixed(0)} pasos/min`, y);
  y = addKeyValue(doc, 'Longitud de paso', `${(metrics.stepLengthMeters ?? 0).toFixed(2)} m`, y);
  y = addKeyValue(doc, 'Asimetría de apoyo', `${(metrics.stanceAsymmetryPct ?? 0).toFixed(1)}%`, y);
  const lowVisibilityPct = (() => {
    const frames = session.poseFrames ?? [];
    if (!frames.length) return 0;
    const key = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    const low = frames.filter((frame) => {
      const mean = key.reduce((sum, idx) => sum + (frame.landmarks?.[idx]?.visibility ?? 0), 0) / key.length;
      return mean < 0.5;
    }).length;
    return (low / frames.length) * 100;
  })();
  const visibilitySeries = (session.poseFrames ?? []).map((frame) => {
    const key = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    const mean = key.reduce((sum, idx) => sum + (frame.landmarks?.[idx]?.visibility ?? 0), 0) / key.length;
    return { t: frame.timestamp, v: mean };
  });
  if (lowVisibilityPct > 30) {
    y = addText(
      doc,
      `Advertencia de calidad: ${Math.round(lowVisibilityPct)}% de frames con baja visibilidad. Interpretar con precaución clínica.`,
      y,
      { color: COLORS.red, size: 8 },
    );
  }
  y += 4;

  // Spatiotemporal chart
  try {
    const stChart = renderSpatiotemporalChart({
      speed: metrics.speedMps,
      cadence: metrics.cadenceSpm,
      stepLength: metrics.stepLengthMeters,
      asymmetry: metrics.stanceAsymmetryPct,
    }, 520, 140);
    doc.addImage(stChart, 'PNG', M, y, CONTENT_W, (CONTENT_W / 520) * 140);
    y += (CONTENT_W / 520) * 140 + 8;
  } catch { /* Canvas not available in SSR */ }

  if (visibilitySeries.length > 1) {
    try {
      const visChart = renderVisibilityTrend(visibilitySeries, 520, 100);
      doc.addImage(visChart, 'PNG', M, y, CONTENT_W, (CONTENT_W / 520) * 100);
      y += (CONTENT_W / 520) * 100 + 6;
    } catch {
      // optional chart
    }
  }

  // Risk gauge
  try {
    const gaugeImg = renderRiskGauge(
      session.report.trafficLight,
      'Riesgo de Caídas',
      160, 100,
    );
    doc.addImage(gaugeImg, 'PNG', M + CONTENT_W - 120, y - 115, 100, 65);
  } catch { /* fallback: text only */ }

  // Detected patterns
  y = addSectionTitle(doc, '3. Patrones Detectados', y);
  if (session.patternFlags.length > 0) {
    session.patternFlags.forEach(flag => {
      const bulletC = flag.status === 'likely' ? COLORS.red
        : flag.status === 'possible' ? COLORS.yellow
        : COLORS.green;
      y = addBullet(doc, `${flag.label}: ${flag.status.replace('_', ' ')}`, y, bulletC);
    });
  } else {
    y = addText(doc, 'No se detectaron patrones patológicos significativos.', y);
  }

  addFooter(doc, 1, totalPages);

  // ═════════════════════════════════════════════════════════════
  // PAGE 2: Gait Phase Analysis + OGS
  // ═════════════════════════════════════════════════════════════

  doc.addPage();
  addHeader(doc, 'ANÁLISIS DE FASES DE LA MARCHA');
  y = 46;

  y = addSectionTitle(doc, '4. Fases del Ciclo de Marcha', y);
  y = addText(doc, 'Representación visual de las 8 fases del ciclo de marcha según Perry & Burnfield. Los colores indican la puntuación OGS (verde=normal, amarillo=leve, rojo=severo).', y);
  y += 4;

  // Gait phase strip (stick figures)
  try {
    const phaseStrip = renderGaitPhaseStripToDataURL(
      1200,
      300,
      ogs?.leftScore,
      ogs?.rightScore,
    );
    const stripH = (CONTENT_W / 1200) * 300;
    doc.addImage(phaseStrip, 'PNG', M, y, CONTENT_W, stripH);
    y += stripH + 12;
  } catch { /* Canvas not available */ }

  // Phase descriptions
  const phaseDesc = [
    ['Contacto Inicial (CI)', 'El talón contacta el suelo. La cadera está en ~30° de flexión, la rodilla en extensión casi completa.'],
    ['Respuesta de Carga (RC)', 'El pie se aplana. La rodilla flexiona ~15-18° para absorber el impacto.'],
    ['Apoyo Medio (AM)', 'El cuerpo pasa sobre el pie de apoyo. La tibia está vertical.'],
    ['Apoyo Terminal (AT)', 'La cadera se extiende ~10°. El talón comienza a elevarse.'],
    ['Pre-Balanceo (PB)', 'Despegue del pie. Rápida flexión de rodilla ~35°. Máxima plantarflexión.'],
    ['Balanceo Inicial (BI)', 'Pie despegado. Máxima flexión de rodilla ~60°.'],
    ['Balanceo Medio (BM)', 'Tibia vertical, pie libre del suelo. Cadera en ~30° flexión.'],
    ['Balanceo Terminal (BT)', 'Pierna completamente extendida preparando el siguiente contacto.'],
  ];

  doc.setFontSize(7);
  phaseDesc.forEach(([title, desc]) => {
    if (y > PAGE_HEIGHT - 80) return;
    y = addText(doc, `${title}: ${desc}`, y, { size: 7 });
  });

  y += 8;

  // OGS Radar Chart
  if (ogs?.leftScore && ogs?.rightScore) {
    y = addSectionTitle(doc, '5. Escala Observacional de Marcha (OGS)', y);

    const phases = ['CI', 'RC', 'AM', 'AT', 'PB', 'BI', 'BM', 'BT'];
    const leftScores = [
      ogs.leftScore.initialFootContact,
      ogs.leftScore.loadingResponse,
      ogs.leftScore.midStance,
      ogs.leftScore.terminalStance,
      ogs.leftScore.preSwing,
      ogs.leftScore.initialSwing,
      ogs.leftScore.midSwing,
      ogs.leftScore.terminalSwing,
    ];
    const rightScores = [
      ogs.rightScore.initialFootContact,
      ogs.rightScore.loadingResponse,
      ogs.rightScore.midStance,
      ogs.rightScore.terminalStance,
      ogs.rightScore.preSwing,
      ogs.rightScore.initialSwing,
      ogs.rightScore.midSwing,
      ogs.rightScore.terminalSwing,
    ];

    try {
      const radarImg = renderOGSRadar({ phases, leftScores, rightScores }, 280, 280);
      doc.addImage(radarImg, 'PNG', M + CONTENT_W / 2 - 100, y, 200, 200);
      y += 205;
    } catch { /* fallback */ }

    // OGS Totals
    y = addKeyValue(doc, 'OGS Izquierda', `${ogs.leftTotal ?? '—'}/24`, y);
    y = addKeyValue(doc, 'OGS Derecha', `${ogs.rightTotal ?? '—'}/24`, y);
    if (ogs.qualityIndex !== null) {
      y = addKeyValue(doc, 'Índice de Calidad', `${ogs.qualityIndex.toFixed(1)}%`, y);
    }
    if (ogs.asymmetryIndex !== null) {
      y = addKeyValue(doc, 'Asimetría OGS', `${ogs.asymmetryIndex.toFixed(1)}%`, y);
    }
  }

  addFooter(doc, 2, totalPages);

  // ═════════════════════════════════════════════════════════════
  // PAGE 3: Kinematic Curves
  // ═════════════════════════════════════════════════════════════

  doc.addPage();
  addHeader(doc, 'CINEMÁTICA ARTICULAR');
  y = 46;

  y = addSectionTitle(doc, '6. Curvas Cinemáticas — Plano Sagital', y);
  y = addText(doc, 'Ángulos articulares del paciente (azul=izquierda, rojo=derecha) comparados con bandas normativas (gris ±1 DE). Línea vertical amarilla marca la transición apoyo–balanceo (60%).', y);
  y += 4;

  // Extract patient kinematic time series if available
  let hipL: number[] | null = null;
  let hipR: number[] | null = null;
  let kneeL: number[] | null = null;
  let kneeR: number[] | null = null;
  let ankleL: number[] | null = null;
  let ankleR: number[] | null = null;

  const kinData = kinSummary?.kinematicData;
  if (kinData?.sagittal) {
    hipL = kinData.sagittal.hipFlexion?.left?.summary?.normalizedCycles?.mean101 ?? kinData.sagittal.hipFlexion?.left?.series?.angles ?? null;
    hipR = kinData.sagittal.hipFlexion?.right?.summary?.normalizedCycles?.mean101 ?? kinData.sagittal.hipFlexion?.right?.series?.angles ?? null;
    kneeL = kinData.sagittal.kneeFlexion?.left?.summary?.normalizedCycles?.mean101 ?? kinData.sagittal.kneeFlexion?.left?.series?.angles ?? null;
    kneeR = kinData.sagittal.kneeFlexion?.right?.summary?.normalizedCycles?.mean101 ?? kinData.sagittal.kneeFlexion?.right?.series?.angles ?? null;
    ankleL = kinData.sagittal.ankleFlexion?.left?.summary?.normalizedCycles?.mean101 ?? kinData.sagittal.ankleFlexion?.left?.series?.angles ?? null;
    ankleR = kinData.sagittal.ankleFlexion?.right?.summary?.normalizedCycles?.mean101 ?? kinData.sagittal.ankleFlexion?.right?.series?.angles ?? null;
  }

  try {
    const charts = renderAllKinematicCharts(
      hipL, hipR, kneeL, kneeR, ankleL, ankleR,
      520, 180,
    );
    const chartH = (CONTENT_W / 520) * 180;

    // Hip
    doc.addImage(charts.hip, 'PNG', M, y, CONTENT_W, chartH);
    y += chartH + 10;

    // Knee
    doc.addImage(charts.knee, 'PNG', M, y, CONTENT_W, chartH);
    y += chartH + 10;

    // Ankle
    doc.addImage(charts.ankle, 'PNG', M, y, CONTENT_W, chartH);
    y += chartH + 10;
  } catch {
    y = addText(doc, 'No se pudieron generar los gráficos cinemáticos (sin datos de Canvas disponibles).', y);
  }

  // ROM summary table
  if (kinSummary) {
    y = addText(doc, 'Resumen de Rango de Movimiento:', y, { bold: true, size: 9 });
    y += 2;

    const romData = [
      ['Articulación', 'Izq. Flexión', 'Izq. Extensión', 'Der. Flexión', 'Der. Extensión'],
      ['Cadera', `${kinSummary.hipROM.left.flexion.toFixed(1)}°`, `${kinSummary.hipROM.left.extension.toFixed(1)}°`, `${kinSummary.hipROM.right.flexion.toFixed(1)}°`, `${kinSummary.hipROM.right.extension.toFixed(1)}°`],
      ['Rodilla', `${kinSummary.kneeROM.left.flexion.toFixed(1)}°`, `${kinSummary.kneeROM.left.extension.toFixed(1)}°`, `${kinSummary.kneeROM.right.flexion.toFixed(1)}°`, `${kinSummary.kneeROM.right.extension.toFixed(1)}°`],
      ['Tobillo', `${kinSummary.ankleROM.left.dorsiflexion.toFixed(1)}°`, `${kinSummary.ankleROM.left.plantarflexion.toFixed(1)}°`, `${kinSummary.ankleROM.right.dorsiflexion.toFixed(1)}°`, `${kinSummary.ankleROM.right.plantarflexion.toFixed(1)}°`],
    ];

    doc.setFontSize(7);
    doc.setFont(FONT, 'bold');
    romData[0].forEach((header, i) => {
      doc.text(header, M + i * (CONTENT_W / 5), y);
    });
    y += 10;
    doc.setFont(FONT, 'normal');
    romData.slice(1).forEach(row => {
      row.forEach((cell, i) => {
        doc.text(cell, M + i * (CONTENT_W / 5), y);
      });
      y += 10;
    });
  }

  addFooter(doc, 3, totalPages);

  // ═════════════════════════════════════════════════════════════
  // PAGE 4: Symmetry and Phase Heatmap
  // ═════════════════════════════════════════════════════════════

  doc.addPage();
  addHeader(doc, 'SIMETRÍA Y FASES');
  y = 46;
  y = addSectionTitle(doc, '7. Simetría izquierda vs derecha', y);
  const symmetryChart = renderSymmetryRadarChart(buildSymmetryRadar(session));
  doc.addImage(symmetryChart, 'PNG', M, y, 240, 240);
  y += 250;
  y = addSectionTitle(doc, '8. Heatmap articular por fase del ciclo', y);
  const phaseHeatmap = renderPhaseHeatmap(kinSummary, 520, 220);
  doc.addImage(phaseHeatmap, 'PNG', M, y, CONTENT_W, 190);
  addFooter(doc, 4, totalPages);

  // ═════════════════════════════════════════════════════════════
  // PAGE 5: Clinical Findings & Recommendations
  // ═════════════════════════════════════════════════════════════

  doc.addPage();
  addHeader(doc, 'HALLAZGOS CLÍNICOS Y RECOMENDACIONES');
  y = 46;

  // Primary findings
  y = addSectionTitle(doc, '7. Hallazgos Clínicos', y);
  if (medReport.clinicalFindings.primaryFindings.length > 0) {
    y = addText(doc, 'Hallazgos principales:', y, { bold: true, size: 9 });
    medReport.clinicalFindings.primaryFindings.forEach(f => {
      y = addBullet(doc, `${f.parameter}: ${f.value} (Rango normal: ${f.normalRange}) — ${f.description}`, y, COLORS.red);
    });
    y += 4;
  }
  if (medReport.clinicalFindings.secondaryFindings.length > 0) {
    y = addText(doc, 'Hallazgos secundarios:', y, { bold: true, size: 9 });
    medReport.clinicalFindings.secondaryFindings.forEach(f => {
      y = addBullet(doc, `${f.parameter}: ${f.value} — ${f.description}`, y, COLORS.yellow);
    });
    y += 4;
  }
  if (medReport.clinicalFindings.normalFindings.length > 0) {
    y = addText(doc, 'Parámetros normales:', y, { bold: true, size: 9 });
    medReport.clinicalFindings.normalFindings.forEach(f => {
      y = addBullet(doc, `${f.parameter}: ${f.value}`, y, COLORS.green);
    });
    y += 4;
  }

  // Pathology
  if (medReport.pathologyAnalysis.primaryFindings.length > 0) {
    y = addSectionTitle(doc, '8. Análisis de Patologías', y);
    medReport.pathologyAnalysis.primaryFindings.forEach(f => {
      y = addBullet(doc, `${f.condition}: ${(f.confidence * 100).toFixed(0)}% confianza (${f.severity})`, y, COLORS.red);
      if (f.evidence.length > 0) {
        y = addText(doc, `Evidencia: ${f.evidence.join(', ')}`, y, { indent: 12, size: 8, color: COLORS.muted });
      }
    });
    y += 4;
  }

  // Functional assessment
  y = addSectionTitle(doc, '9. Evaluación Funcional', y);
  y = addKeyValue(doc, 'Nivel de Movilidad', medReport.functionalAssessment.mobilityLevel, y);
  y = addKeyValue(doc, 'Riesgo de Caídas', medReport.functionalAssessment.fallRisk, y);
  y = addKeyValue(doc, 'Eficiencia Energética', medReport.functionalAssessment.energyEfficiency, y);
  y = addKeyValue(doc, 'Ambulación Comunitaria', medReport.functionalAssessment.communityAmbulation, y);
  if (medReport.functionalAssessment.assistiveDeviceRecommendation) {
    y = addKeyValue(doc, 'Dispositivo Sugerido', medReport.functionalAssessment.assistiveDeviceRecommendation, y);
  }
  y += 4;

  // Recommendations
  y = addSectionTitle(doc, '10. Recomendaciones', y);
  if (medReport.recommendations.immediate.length > 0) {
    y = addText(doc, 'Inmediatas:', y, { bold: true, size: 9 });
    medReport.recommendations.immediate.forEach(rec => {
      y = addBullet(doc, `${rec.intervention} (${rec.timeframe}) — ${rec.rationale}`, y, COLORS.red);
    });
    y += 2;
  }
  if (medReport.recommendations.shortTerm.length > 0) {
    y = addText(doc, 'Corto plazo:', y, { bold: true, size: 9 });
    medReport.recommendations.shortTerm.forEach(rec => {
      y = addBullet(doc, `${rec.intervention} (${rec.timeframe})`, y, COLORS.yellow);
    });
    y += 2;
  }
  if (medReport.recommendations.longTerm.length > 0) {
    y = addText(doc, 'Largo plazo:', y, { bold: true, size: 9 });
    medReport.recommendations.longTerm.forEach(rec => {
      y = addBullet(doc, `${rec.intervention} (${rec.timeframe})`, y, COLORS.accent);
    });
    y += 2;
  }

  // Follow-up
  if (y < PAGE_HEIGHT - 120) {
    y = addSectionTitle(doc, '11. Plan de Seguimiento', y);
    y = addKeyValue(doc, 'Próxima evaluación', medReport.followUp.nextAssessment, y);
    y = addText(doc, `Parámetros a monitorizar: ${medReport.followUp.monitoringParameters.join(', ')}`, y, { size: 8 });
    y += 8;
  }

  // Clinician notes
  if (session.patient?.clinicianNote) {
    y = addSectionTitle(doc, '12. Comentario del Clínico', y);
    y = addText(doc, session.patient.clinicianNote, y);
    y += 4;
  }

  // References
  if (y < PAGE_HEIGHT - 80) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(6);
    doc.setTextColor(COLORS.muted);
    y = PAGE_HEIGHT - 70;
    doc.text('Referencias:', M, y);
    y += 8;
    medReport.references.forEach(ref => {
      const lines = doc.splitTextToSize(ref, CONTENT_W);
      doc.text(lines, M, y);
      y += lines.length * 7;
    });
  }

  addFooter(doc, 5, totalPages);

  return doc.output('blob');
}
