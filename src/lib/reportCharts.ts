/**
 * Report Chart Renderers
 *
 * Canvas-based chart generators designed for embedding in PDF reports.
 * Each function renders onto a canvas and returns a data URL.
 */

import type { NormativeCurve } from './normativeData.ts';
import { NORMATIVE_SAGITTAL_CURVES, NORMATIVE_SPATIOTEMPORAL } from './normativeData.ts';

// ═══════════════════════════════════════════════════════════════
// KINEMATIC ANGLE CHART
// Joint angle (°) vs % gait cycle with normative band
// ═══════════════════════════════════════════════════════════════

interface KinematicChartOptions {
  /** Chart title */
  title: string;
  /** Normative reference curve */
  normative: NormativeCurve;
  /** Patient data: array of angle values at each % of cycle (up to 101 points) */
  patientData?: number[] | null;
  /** Patient data for the contralateral side */
  patientDataContralateral?: number[] | null;
  /** Canvas width */
  width?: number;
  /** Canvas height */
  height?: number;
}

/**
 * Render a single kinematic angle chart with normative band.
 */
export function renderKinematicChart(options: KinematicChartOptions): string {
  const {
    title,
    normative,
    patientData,
    patientDataContralateral,
    width = 520,
    height = 200,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const margin = { top: 28, right: 15, bottom: 32, left: 45 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  // Determine Y range from normative data
  const allValues = [...normative.upper, ...normative.lower];
  if (patientData) allValues.push(...patientData);
  if (patientDataContralateral) allValues.push(...patientDataContralateral);

  const yMin = Math.floor(Math.min(...allValues) / 10) * 10 - 5;
  const yMax = Math.ceil(Math.max(...allValues) / 10) * 10 + 5;
  const yRange = yMax - yMin;

  const xToCanvas = (pct: number) => margin.left + (pct / 100) * plotW;
  const yToCanvas = (val: number) => margin.top + plotH - ((val - yMin) / yRange) * plotH;

  // Grid lines
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 0.5;
  for (let y = Math.ceil(yMin / 10) * 10; y <= yMax; y += 10) {
    const cy = yToCanvas(y);
    ctx.beginPath();
    ctx.moveTo(margin.left, cy);
    ctx.lineTo(width - margin.right, cy);
    ctx.stroke();
  }
  for (let x = 0; x <= 100; x += 20) {
    const cx = xToCanvas(x);
    ctx.beginPath();
    ctx.moveTo(cx, margin.top);
    ctx.lineTo(cx, margin.top + plotH);
    ctx.stroke();
  }

  // Zero line
  if (yMin < 0 && yMax > 0) {
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    const zeroY = yToCanvas(0);
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(width - margin.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Normative band (filled area ± 1 SD)
  ctx.fillStyle = 'rgba(156, 163, 175, 0.2)';
  ctx.beginPath();
  ctx.moveTo(xToCanvas(0), yToCanvas(normative.upper[0]));
  for (let i = 1; i <= 100; i++) {
    ctx.lineTo(xToCanvas(i), yToCanvas(normative.upper[i]));
  }
  for (let i = 100; i >= 0; i--) {
    ctx.lineTo(xToCanvas(i), yToCanvas(normative.lower[i]));
  }
  ctx.closePath();
  ctx.fill();

  // Normative mean line
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](xToCanvas(i), yToCanvas(normative.mean[i]));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Patient data — left (primary)
  if (patientData && patientData.length > 0) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const step = 100 / (patientData.length - 1);
    for (let i = 0; i < patientData.length; i++) {
      const pct = i * step;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](xToCanvas(pct), yToCanvas(patientData[i]));
    }
    ctx.stroke();
  }

  // Patient data — right (contralateral)
  if (patientDataContralateral && patientDataContralateral.length > 0) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    const step = 100 / (patientDataContralateral.length - 1);
    for (let i = 0; i < patientDataContralateral.length; i++) {
      const pct = i * step;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](xToCanvas(pct), yToCanvas(patientDataContralateral[i]));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Stance/Swing divider at 60%
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  const dividerX = xToCanvas(60);
  ctx.beginPath();
  ctx.moveTo(dividerX, margin.top);
  ctx.lineTo(dividerX, margin.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Phase labels
  ctx.fillStyle = '#93c5fd';
  ctx.font = '7px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Apoyo', xToCanvas(30), margin.top + 10);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('Balanceo', xToCanvas(80), margin.top + 10);

  // Axes labels
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 14);

  // Y axis
  ctx.font = '8px system-ui';
  ctx.textAlign = 'right';
  for (let y = Math.ceil(yMin / 10) * 10; y <= yMax; y += 10) {
    ctx.fillText(`${y}°`, margin.left - 4, yToCanvas(y) + 3);
  }

  // X axis
  ctx.textAlign = 'center';
  for (let x = 0; x <= 100; x += 20) {
    ctx.fillText(`${x}%`, xToCanvas(x), height - margin.bottom + 14);
  }
  ctx.font = '8px system-ui';
  ctx.fillText('% Ciclo de Marcha', width / 2, height - 4);

  // Legend
  const legendY = margin.top + plotH + 20;
  ctx.font = '7px system-ui';
  ctx.textAlign = 'left';

  // Normative legend
  ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
  ctx.fillRect(margin.left, legendY, 12, 6);
  ctx.fillStyle = '#6b7280';
  ctx.fillText('Normativo (±1 SD)', margin.left + 16, legendY + 6);

  // Patient left
  if (patientData) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left + 120, legendY + 3);
    ctx.lineTo(margin.left + 132, legendY + 3);
    ctx.stroke();
    ctx.fillStyle = '#2563eb';
    ctx.fillText('Izquierda', margin.left + 136, legendY + 6);
  }

  // Patient right
  if (patientDataContralateral) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(margin.left + 200, legendY + 3);
    ctx.lineTo(margin.left + 212, legendY + 3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#dc2626';
    ctx.fillText('Derecha', margin.left + 216, legendY + 6);
  }

  return canvas.toDataURL('image/png');
}

// ═══════════════════════════════════════════════════════════════
// SPATIOTEMPORAL BAR CHART
// ═══════════════════════════════════════════════════════════════

interface SpatiotemporalData {
  speed: number | null;
  cadence: number | null;
  stepLength: number | null;
  asymmetry: number | null;
}

/**
 * Render a bar chart comparing patient spatiotemporal values against normative ranges.
 */
export function renderSpatiotemporalChart(
  data: SpatiotemporalData,
  width = 520,
  height = 160,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  const norms = NORMATIVE_SPATIOTEMPORAL;
  const params = [
    { key: 'speed' as const, label: 'Velocidad', value: data.speed, norm: norms.speed, format: (v: number) => `${v.toFixed(2)} m/s` },
    { key: 'cadence' as const, label: 'Cadencia', value: data.cadence, norm: norms.cadence, format: (v: number) => `${v.toFixed(0)} p/min` },
    { key: 'stepLength' as const, label: 'Long. Paso', value: data.stepLength, norm: norms.stepLength, format: (v: number) => `${v.toFixed(2)} m` },
    { key: 'asymmetry' as const, label: 'Asimetría', value: data.asymmetry, norm: norms.asymmetry, format: (v: number) => `${v.toFixed(1)}%` },
  ];

  const margin = { top: 24, right: 20, bottom: 14, left: 80 };
  const barH = 22;
  const gap = 10;

  // Title
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Parámetros Espaciotemporales', width / 2, 14);

  params.forEach((param, i) => {
    const y = margin.top + i * (barH + gap);
    const value = param.value ?? 0;

    // Determine how many SDs from normal
    const zScore = Math.abs(value - param.norm.mean) / param.norm.sd;
    let color = '#22c55e'; // green = normal
    if (zScore > 2) color = '#ef4444'; // red
    else if (zScore > 1) color = '#f59e0b'; // yellow

    // For asymmetry, invert (high is bad)
    if (param.key === 'asymmetry' && value > 10) color = '#ef4444';
    else if (param.key === 'asymmetry' && value > 5) color = '#f59e0b';

    // Label
    ctx.fillStyle = '#374151';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(param.label, margin.left - 6, y + barH / 2 + 3);

    // Background bar
    const barW = width - margin.left - margin.right;
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.roundRect(margin.left, y, barW, barH, 4);
    ctx.fill();

    // Normative range indicator
    const normMin = param.norm.mean - param.norm.sd;
    const normMax = param.norm.mean + param.norm.sd;
    const displayMax = param.norm.mean + 3 * param.norm.sd;
    const normStartPx = margin.left + (Math.max(0, normMin) / displayMax) * barW;
    const normEndPx = margin.left + (normMax / displayMax) * barW;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fillRect(normStartPx, y, normEndPx - normStartPx, barH);

    // Value bar
    const valuePx = Math.min((value / displayMax) * barW, barW);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(margin.left, y, valuePx, barH, 4);
    ctx.fill();

    // Value text
    ctx.fillStyle = valuePx > barW * 0.3 ? '#fff' : '#374151';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = valuePx > barW * 0.3 ? 'right' : 'left';
    const textX = valuePx > barW * 0.3 ? margin.left + valuePx - 4 : margin.left + valuePx + 4;
    ctx.fillText(param.format(value), textX, y + barH / 2 + 3);

    // Normal range label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '7px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`Norm: ${param.norm.mean.toFixed(1)}±${param.norm.sd.toFixed(1)}`, width - margin.right, y + barH / 2 + 3);
  });

  return canvas.toDataURL('image/png');
}

// ═══════════════════════════════════════════════════════════════
// RISK GAUGE
// ═══════════════════════════════════════════════════════════════

/**
 * Render a semi-circular risk gauge.
 */
export function renderRiskGauge(
  riskLevel: 'green' | 'yellow' | 'red',
  label: string,
  width = 160,
  height = 100,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height - 15;
  const radius = Math.min(width, height) * 0.38;

  // Background arc
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';

  // Green zone
  ctx.strokeStyle = '#dcfce7';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, Math.PI + (Math.PI / 3), false);
  ctx.stroke();

  // Yellow zone
  ctx.strokeStyle = '#fef9c3';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI + (Math.PI / 3), Math.PI + (2 * Math.PI / 3), false);
  ctx.stroke();

  // Red zone
  ctx.strokeStyle = '#fee2e2';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI + (2 * Math.PI / 3), 2 * Math.PI, false);
  ctx.stroke();

  // Active indicator
  let needleAngle: number;
  let activeColor: string;
  switch (riskLevel) {
    case 'green':
      needleAngle = Math.PI + Math.PI / 6;
      activeColor = '#22c55e';
      break;
    case 'yellow':
      needleAngle = Math.PI + Math.PI / 2;
      activeColor = '#eab308';
      break;
    case 'red':
      needleAngle = Math.PI + (5 * Math.PI / 6);
      activeColor = '#ef4444';
      break;
  }

  // Needle
  const needleLen = radius - 8;
  ctx.strokeStyle = activeColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(
    cx + needleLen * Math.cos(needleAngle),
    cy + needleLen * Math.sin(needleAngle),
  );
  ctx.stroke();

  // Center dot
  ctx.fillStyle = activeColor;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Label
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, 14);

  // Risk text
  const riskTexts = { green: 'BAJO', yellow: 'MODERADO', red: 'ALTO' };
  ctx.fillStyle = activeColor;
  ctx.font = 'bold 12px system-ui';
  ctx.fillText(riskTexts[riskLevel], cx, cy + 12);

  return canvas.toDataURL('image/png');
}

// ═══════════════════════════════════════════════════════════════
// OGS RADAR CHART
// ═══════════════════════════════════════════════════════════════

interface OGSRadarData {
  phases: string[];
  leftScores: (number | null)[];
  rightScores: (number | null)[];
}

/**
 * Render an OGS spider/radar chart comparing left vs right.
 */
export function renderOGSRadar(
  data: OGSRadarData,
  width = 280,
  height = 280,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2 + 10;
  const maxRadius = Math.min(width, height) * 0.35;
  const n = data.phases.length;
  const maxScore = 3; // OGS max

  // Title
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Escala OGS — Izq vs Der', cx, 14);

  // Grid rings
  [1, 2, 3].forEach(level => {
    const r = (level / maxScore) * maxRadius;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Score label
    ctx.fillStyle = '#d1d5db';
    ctx.font = '7px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${level}`, cx + 2, cy - r + 8);
  });

  // Spoke lines + labels
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + maxRadius * Math.cos(angle);
    const y = cy + maxRadius * Math.sin(angle);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Phase label
    const labelR = maxRadius + 18;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    ctx.fillStyle = '#374151';
    ctx.font = '7px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.phases[i], lx, ly);
  }

  // Plot function
  const plotScores = (scores: (number | null)[], color: string, fillColor: string) => {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const val = scores[i] ?? 0;
      const r = (Math.max(0, val + 1) / (maxScore + 1)) * maxRadius; // Map -1..3 to 0..maxR
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Left (blue)
  plotScores(data.leftScores, '#2563eb', 'rgba(37, 99, 235, 0.15)');
  // Right (red)
  plotScores(data.rightScores, '#dc2626', 'rgba(220, 38, 38, 0.12)');

  // Legend
  ctx.font = '8px system-ui';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(width / 2 - 50, height - 18, 8, 8);
  ctx.fillText('Izquierda', width / 2 - 38, height - 11);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(width / 2 + 15, height - 18, 8, 8);
  ctx.fillText('Derecha', width / 2 + 27, height - 11);

  return canvas.toDataURL('image/png');
}

/**
 * Render all three kinematic charts (hip, knee, ankle) and return data URLs.
 */
export function renderAllKinematicCharts(
  hipDataL?: number[] | null,
  hipDataR?: number[] | null,
  kneeDataL?: number[] | null,
  kneeDataR?: number[] | null,
  ankleDataL?: number[] | null,
  ankleDataR?: number[] | null,
  chartWidth = 520,
  chartHeight = 180,
): { hip: string; knee: string; ankle: string } {
  return {
    hip: renderKinematicChart({
      title: NORMATIVE_SAGITTAL_CURVES[0].jointName,
      normative: NORMATIVE_SAGITTAL_CURVES[0],
      patientData: hipDataL,
      patientDataContralateral: hipDataR,
      width: chartWidth,
      height: chartHeight,
    }),
    knee: renderKinematicChart({
      title: NORMATIVE_SAGITTAL_CURVES[1].jointName,
      normative: NORMATIVE_SAGITTAL_CURVES[1],
      patientData: kneeDataL,
      patientDataContralateral: kneeDataR,
      width: chartWidth,
      height: chartHeight,
    }),
    ankle: renderKinematicChart({
      title: NORMATIVE_SAGITTAL_CURVES[2].jointName,
      normative: NORMATIVE_SAGITTAL_CURVES[2],
      patientData: ankleDataL,
      patientDataContralateral: ankleDataR,
      width: chartWidth,
      height: chartHeight,
    }),
  };
}
