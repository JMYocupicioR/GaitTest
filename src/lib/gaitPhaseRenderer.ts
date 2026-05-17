/**
 * Gait Phase Stick-Figure Renderer
 *
 * Draws anatomically accurate stick figures for each of the 8 gait phases
 * (Perry & Burnfield classification) on a Canvas element.
 * Each figure includes joint angle indicators and optional OGS score coloring.
 */

import type { OGSScore, OGSItemScore } from '../types/session.ts';

/** Joint positions for a stick figure (normalized 0–1 coordinate space) */
interface StickFigurePose {
  head: { x: number; y: number };
  neck: { x: number; y: number };
  shoulder: { x: number; y: number };
  hip: { x: number; y: number };
  knee: { x: number; y: number };
  ankle: { x: number; y: number };
  toe: { x: number; y: number };
  heel: { x: number; y: number };
  /** Optional: contralateral leg */
  hipC?: { x: number; y: number };
  kneeC?: { x: number; y: number };
  ankleC?: { x: number; y: number };
  toeC?: { x: number; y: number };
}

/** Angles displayed for each phase */
interface PhaseAngles {
  hip: number;
  knee: number;
  ankle: number;
}

interface PhaseDefinition {
  name: string;
  shortName: string;
  ogsKey: keyof OGSScore;
  pose: StickFigurePose;
  angles: PhaseAngles;
  description: string;
  /** Ground contact indicator */
  footOnGround: boolean;
}

// ═══════════════════════════════════════════════════════════════
// PHASE DEFINITIONS — anatomical stick figure poses
// All coordinates normalized to a 0–1 space (origin top-left)
// ═══════════════════════════════════════════════════════════════

const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    name: 'Contacto Inicial',
    shortName: 'CI',
    ogsKey: 'initialFootContact',
    footOnGround: true,
    angles: { hip: 30, knee: 5, ankle: 0 },
    description: 'Talón contacta el suelo, cadera en flexión',
    pose: {
      head: { x: 0.45, y: 0.08 },
      neck: { x: 0.45, y: 0.15 },
      shoulder: { x: 0.45, y: 0.22 },
      hip: { x: 0.48, y: 0.45 },
      knee: { x: 0.55, y: 0.65 },
      ankle: { x: 0.58, y: 0.85 },
      toe: { x: 0.62, y: 0.88 },
      heel: { x: 0.56, y: 0.88 },
      kneeC: { x: 0.38, y: 0.65 },
      ankleC: { x: 0.35, y: 0.85 },
      toeC: { x: 0.38, y: 0.88 },
    },
  },
  {
    name: 'Respuesta de Carga',
    shortName: 'RC',
    ogsKey: 'loadingResponse',
    footOnGround: true,
    angles: { hip: 25, knee: 18, ankle: -5 },
    description: 'Pie plano, rodilla absorbe impacto',
    pose: {
      head: { x: 0.47, y: 0.08 },
      neck: { x: 0.47, y: 0.15 },
      shoulder: { x: 0.47, y: 0.22 },
      hip: { x: 0.50, y: 0.45 },
      knee: { x: 0.54, y: 0.64 },
      ankle: { x: 0.55, y: 0.85 },
      toe: { x: 0.60, y: 0.88 },
      heel: { x: 0.52, y: 0.88 },
      kneeC: { x: 0.40, y: 0.62 },
      ankleC: { x: 0.38, y: 0.82 },
      toeC: { x: 0.40, y: 0.88 },
    },
  },
  {
    name: 'Apoyo Medio',
    shortName: 'AM',
    ogsKey: 'midStance',
    footOnGround: true,
    angles: { hip: 0, knee: 5, ankle: 5 },
    description: 'Tibia vertical, cuerpo sobre el pie',
    pose: {
      head: { x: 0.50, y: 0.08 },
      neck: { x: 0.50, y: 0.15 },
      shoulder: { x: 0.50, y: 0.22 },
      hip: { x: 0.50, y: 0.45 },
      knee: { x: 0.50, y: 0.65 },
      ankle: { x: 0.50, y: 0.85 },
      toe: { x: 0.56, y: 0.88 },
      heel: { x: 0.46, y: 0.88 },
      kneeC: { x: 0.44, y: 0.58 },
      ankleC: { x: 0.40, y: 0.72 },
      toeC: { x: 0.38, y: 0.75 },
    },
  },
  {
    name: 'Apoyo Terminal',
    shortName: 'AT',
    ogsKey: 'terminalStance',
    footOnGround: true,
    angles: { hip: -10, knee: 3, ankle: 10 },
    description: 'Cadera en extensión, talón se eleva',
    pose: {
      head: { x: 0.52, y: 0.08 },
      neck: { x: 0.52, y: 0.15 },
      shoulder: { x: 0.52, y: 0.22 },
      hip: { x: 0.50, y: 0.45 },
      knee: { x: 0.48, y: 0.65 },
      ankle: { x: 0.45, y: 0.85 },
      toe: { x: 0.50, y: 0.88 },
      heel: { x: 0.42, y: 0.86 },
      kneeC: { x: 0.58, y: 0.56 },
      ankleC: { x: 0.60, y: 0.72 },
      toeC: { x: 0.63, y: 0.75 },
    },
  },
  {
    name: 'Pre-Balanceo',
    shortName: 'PB',
    ogsKey: 'preSwing',
    footOnGround: true,
    angles: { hip: 0, knee: 35, ankle: -20 },
    description: 'Despegue del pie, flexión rápida de rodilla',
    pose: {
      head: { x: 0.55, y: 0.08 },
      neck: { x: 0.55, y: 0.15 },
      shoulder: { x: 0.55, y: 0.22 },
      hip: { x: 0.52, y: 0.45 },
      knee: { x: 0.46, y: 0.62 },
      ankle: { x: 0.42, y: 0.80 },
      toe: { x: 0.44, y: 0.88 },
      heel: { x: 0.40, y: 0.82 },
      kneeC: { x: 0.60, y: 0.63 },
      ankleC: { x: 0.60, y: 0.85 },
      toeC: { x: 0.64, y: 0.88 },
    },
  },
  {
    name: 'Balanceo Inicial',
    shortName: 'BI',
    ogsKey: 'initialSwing',
    footOnGround: false,
    angles: { hip: 15, knee: 60, ankle: -5 },
    description: 'Pie despegado, máx flexión de rodilla',
    pose: {
      head: { x: 0.52, y: 0.08 },
      neck: { x: 0.52, y: 0.15 },
      shoulder: { x: 0.52, y: 0.22 },
      hip: { x: 0.50, y: 0.45 },
      knee: { x: 0.48, y: 0.58 },
      ankle: { x: 0.42, y: 0.72 },
      toe: { x: 0.40, y: 0.75 },
      heel: { x: 0.43, y: 0.74 },
      kneeC: { x: 0.54, y: 0.65 },
      ankleC: { x: 0.55, y: 0.85 },
      toeC: { x: 0.59, y: 0.88 },
    },
  },
  {
    name: 'Balanceo Medio',
    shortName: 'BM',
    ogsKey: 'midSwing',
    footOnGround: false,
    angles: { hip: 30, knee: 30, ankle: 0 },
    description: 'Tibia vertical, pie libre del suelo',
    pose: {
      head: { x: 0.50, y: 0.08 },
      neck: { x: 0.50, y: 0.15 },
      shoulder: { x: 0.50, y: 0.22 },
      hip: { x: 0.50, y: 0.45 },
      knee: { x: 0.55, y: 0.56 },
      ankle: { x: 0.52, y: 0.72 },
      toe: { x: 0.55, y: 0.75 },
      heel: { x: 0.50, y: 0.74 },
      kneeC: { x: 0.46, y: 0.65 },
      ankleC: { x: 0.46, y: 0.85 },
      toeC: { x: 0.50, y: 0.88 },
    },
  },
  {
    name: 'Balanceo Terminal',
    shortName: 'BT',
    ogsKey: 'terminalSwing',
    footOnGround: false,
    angles: { hip: 30, knee: 5, ankle: 0 },
    description: 'Pierna extendida preparando contacto',
    pose: {
      head: { x: 0.48, y: 0.08 },
      neck: { x: 0.48, y: 0.15 },
      shoulder: { x: 0.48, y: 0.22 },
      hip: { x: 0.50, y: 0.45 },
      knee: { x: 0.57, y: 0.62 },
      ankle: { x: 0.60, y: 0.82 },
      toe: { x: 0.64, y: 0.85 },
      heel: { x: 0.58, y: 0.85 },
      kneeC: { x: 0.43, y: 0.65 },
      ankleC: { x: 0.42, y: 0.85 },
      toeC: { x: 0.46, y: 0.88 },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// COLOR MAPPING
// ═══════════════════════════════════════════════════════════════

function ogsScoreColor(score: OGSItemScore | null): string {
  if (score === null) return '#6b7280'; // gray
  if (score >= 3) return '#22c55e';     // green — normal
  if (score >= 2) return '#84cc16';     // lime — almost normal
  if (score >= 1) return '#eab308';     // yellow — mild
  if (score >= 0) return '#f97316';     // orange — moderate
  return '#ef4444';                     // red — severe
}

// ═══════════════════════════════════════════════════════════════
// SINGLE PHASE RENDERER
// ═══════════════════════════════════════════════════════════════

function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  pose: StickFigurePose,
  width: number,
  height: number,
  color: string,
  footOnGround: boolean,
) {
  const scale = (p: { x: number; y: number }) => ({
    x: p.x * width,
    y: p.y * height,
  });

  const s = {
    head: scale(pose.head),
    neck: scale(pose.neck),
    shoulder: scale(pose.shoulder),
    hip: scale(pose.hip),
    knee: scale(pose.knee),
    ankle: scale(pose.ankle),
    toe: scale(pose.toe),
    heel: scale(pose.heel),
    kneeC: pose.kneeC ? scale(pose.kneeC) : null,
    ankleC: pose.ankleC ? scale(pose.ankleC) : null,
    toeC: pose.toeC ? scale(pose.toeC) : null,
  };

  // Draw ground line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const groundY = height * 0.90;
  ctx.beginPath();
  ctx.moveTo(width * 0.1, groundY);
  ctx.lineTo(width * 0.9, groundY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw contralateral leg (lighter)
  if (s.kneeC && s.ankleC) {
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(s.hip.x, s.hip.y);
    ctx.lineTo(s.kneeC.x, s.kneeC.y);
    ctx.lineTo(s.ankleC.x, s.ankleC.y);
    if (s.toeC) ctx.lineTo(s.toeC.x, s.toeC.y);
    ctx.stroke();

    // Contralateral joints
    [s.kneeC, s.ankleC].forEach(joint => {
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.arc(joint.x, joint.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw main body segments
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Trunk (neck → hip)
  ctx.beginPath();
  ctx.moveTo(s.neck.x, s.neck.y);
  ctx.lineTo(s.shoulder.x, s.shoulder.y);
  ctx.lineTo(s.hip.x, s.hip.y);
  ctx.stroke();

  // Thigh (hip → knee)
  ctx.beginPath();
  ctx.moveTo(s.hip.x, s.hip.y);
  ctx.lineTo(s.knee.x, s.knee.y);
  ctx.stroke();

  // Shank (knee → ankle)
  ctx.beginPath();
  ctx.moveTo(s.knee.x, s.knee.y);
  ctx.lineTo(s.ankle.x, s.ankle.y);
  ctx.stroke();

  // Foot (heel → toe)
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s.heel.x, s.heel.y);
  ctx.lineTo(s.toe.x, s.toe.y);
  ctx.stroke();

  // Ground contact indicator
  if (footOnGround) {
    ctx.fillStyle = color + '40';
    ctx.beginPath();
    ctx.ellipse(
      (s.heel.x + s.toe.x) / 2,
      groundY,
      Math.abs(s.toe.x - s.heel.x) / 2 + 4,
      3,
      0, 0, Math.PI * 2,
    );
    ctx.fill();
  }

  // Draw joints
  const joints = [s.hip, s.knee, s.ankle];
  joints.forEach(joint => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Draw head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(s.head.x, s.head.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════
// FULL PHASE STRIP RENDERER (all 8 phases in a strip)
// ═══════════════════════════════════════════════════════════════

/**
 * Render all 8 gait phases as a horizontal strip of stick figures.
 *
 * @param canvas - Target canvas element (should be ~1200×300 for PDF, or responsive)
 * @param ogsLeft - Optional left OGS scores for color coding
 * @param ogsRight - Optional right OGS scores for secondary indicator
 * @returns The canvas element with rendered content
 */
export function renderGaitPhaseStrip(
  canvas: HTMLCanvasElement,
  ogsLeft?: OGSScore | null,
  ogsRight?: OGSScore | null,
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const phaseW = W / 8;

  // Background
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, W, H);

  // Stance / Swing divider
  const stanceEnd = 5 * phaseW; // First 5 phases are stance
  ctx.fillStyle = '#dbeafe20';
  ctx.fillRect(0, 0, stanceEnd, H);
  ctx.fillStyle = '#fef3c720';
  ctx.fillRect(stanceEnd, 0, W - stanceEnd, H);

  // Phase labels at top
  ctx.fillStyle = '#1e40af';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FASE DE APOYO (60%)', stanceEnd / 2, 12);
  ctx.fillStyle = '#92400e';
  ctx.fillText('FASE DE BALANCEO (40%)', stanceEnd + (W - stanceEnd) / 2, 12);

  // Render each phase
  PHASE_DEFINITIONS.forEach((phase, i) => {
    const offsetX = i * phaseW;
    const leftScore = ogsLeft ? ogsLeft[phase.ogsKey] : null;
    const rightScore = ogsRight ? ogsRight[phase.ogsKey] : null;

    // Phase separator
    if (i > 0) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(offsetX, 16);
      ctx.lineTo(offsetX, H - 30);
      ctx.stroke();
    }

    // Create sub-canvas area
    ctx.save();
    ctx.translate(offsetX, 18);

    const color = ogsScoreColor(leftScore);

    drawStickFigure(
      ctx,
      phase.pose,
      phaseW,
      H - 80,
      color,
      phase.footOnGround,
    );

    ctx.restore();

    // Phase name below figure
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(phase.shortName, offsetX + phaseW / 2, H - 52);

    ctx.font = '7px system-ui, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(phase.name, offsetX + phaseW / 2, H - 42);

    // Angle annotations
    ctx.font = '7px monospace';
    ctx.fillStyle = '#374151';
    const angStr = `C${phase.angles.hip}° R${phase.angles.knee}° T${phase.angles.ankle}°`;
    ctx.fillText(angStr, offsetX + phaseW / 2, H - 30);

    // OGS score badges
    if (leftScore !== null) {
      const badgeX = offsetX + phaseW / 2 - 14;
      const badgeY = H - 20;
      ctx.fillStyle = ogsScoreColor(leftScore);
      roundRect(ctx, badgeX, badgeY, 12, 12, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px system-ui';
      ctx.fillText(`I:${leftScore}`, badgeX + 6, badgeY + 9);
    }
    if (rightScore !== null) {
      const badgeX = offsetX + phaseW / 2 + 2;
      const badgeY = H - 20;
      ctx.fillStyle = ogsScoreColor(rightScore);
      roundRect(ctx, badgeX, badgeY, 12, 12, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px system-ui';
      ctx.fillText(`D:${rightScore}`, badgeX + 6, badgeY + 9);
    }
  });

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Create a canvas and render the gait phase strip.
 * Useful for PDF embedding — returns a data URL.
 */
export function renderGaitPhaseStripToDataURL(
  width: number,
  height: number,
  ogsLeft?: OGSScore | null,
  ogsRight?: OGSScore | null,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  renderGaitPhaseStrip(canvas, ogsLeft, ogsRight);
  return canvas.toDataURL('image/png');
}

export { PHASE_DEFINITIONS };
export type { PhaseDefinition, PhaseAngles };
