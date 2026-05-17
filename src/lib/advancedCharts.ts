import { GAIT_PHASES } from './normativeData.ts';
import { renderOGSRadar } from './reportCharts.ts';
import type { SymmetryRadarData } from './symmetryRadar.ts';
import type { KinematicSummary } from '../types/session.ts';

export function renderSymmetryRadarChart(data: SymmetryRadarData): string {
  return renderOGSRadar(
    {
      phases: data.labels,
      leftScores: data.leftScores.map((v) => Math.max(0, Math.min(3, v))),
      rightScores: data.rightScores.map((v) => Math.max(0, Math.min(3, v))),
    },
    320,
    320,
  );
}

export function renderPhaseHeatmap(summary: KinematicSummary | undefined, width = 520, height = 220): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  const joints = ['hip', 'knee', 'ankle'] as const;
  const phases = GAIT_PHASES;
  const x0 = 100;
  const y0 = 32;
  const cellW = (width - x0 - 16) / phases.length;
  const cellH = (height - y0 - 24) / joints.length;

  const severityValue = (joint: string): number => {
    const deviations = summary?.deviations?.filter((d) => d.joint === joint) ?? [];
    if (!deviations.length) return 0;
    const score = deviations.reduce((sum, d) => {
      if (d.severity === 'severe') return sum + 1;
      if (d.severity === 'moderate') return sum + 0.65;
      return sum + 0.35;
    }, 0) / deviations.length;
    return Math.max(0, Math.min(1, score));
  };

  const jointScores = {
    hip: severityValue('hip'),
    knee: severityValue('knee'),
    ankle: severityValue('ankle'),
  };

  ctx.font = 'bold 11px system-ui';
  ctx.fillStyle = '#374151';
  ctx.fillText('Heatmap desviación articulación × fase', 12, 16);
  ctx.font = '9px system-ui';

  phases.forEach((phase, i) => {
    ctx.fillStyle = '#6b7280';
    ctx.fillText(phase.shortName, x0 + i * cellW + 4, y0 - 8);
  });

  joints.forEach((joint, row) => {
    ctx.fillStyle = '#374151';
    ctx.fillText(joint.toUpperCase(), 12, y0 + row * cellH + cellH / 2 + 4);
    phases.forEach((_, col) => {
      const value = Math.max(0, Math.min(1, jointScores[joint] * (0.85 + (col / phases.length) * 0.3)));
      const hue = Math.round((1 - value) * 120);
      ctx.fillStyle = `hsl(${hue}, 72%, 55%)`;
      ctx.fillRect(x0 + col * cellW, y0 + row * cellH, cellW - 2, cellH - 2);
    });
  });

  return canvas.toDataURL('image/png');
}

export function renderVisibilityTrend(
  visibilitySeries: Array<{ t: number; v: number }>,
  width = 520,
  height = 120,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (visibilitySeries.length < 2) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px system-ui';
    ctx.fillText('Sin suficientes datos de visibilidad', 12, 24);
    return canvas.toDataURL('image/png');
  }

  const xToCanvas = (idx: number) => (idx / (visibilitySeries.length - 1)) * (width - 20) + 10;
  const yToCanvas = (v: number) => height - 16 - Math.max(0, Math.min(1, v)) * (height - 30);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  [0.5, 0.8].forEach((line) => {
    const y = yToCanvas(line);
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(width - 10, y);
    ctx.stroke();
  });

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  visibilitySeries.forEach((point, idx) => {
    const x = xToCanvas(idx);
    const y = yToCanvas(point.v);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = '10px system-ui';
  ctx.fillText('Confianza de landmarks (0-1)', 12, 12);

  return canvas.toDataURL('image/png');
}
