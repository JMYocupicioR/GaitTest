import { useEffect, useRef } from 'react';
import { renderGaitPhaseStrip } from '../lib/gaitPhaseRenderer.ts';
import type { OGSScore } from '../types/session.ts';

interface GaitPhaseDiagramProps {
  ogsLeft?: OGSScore | null;
  ogsRight?: OGSScore | null;
  width?: number;
  height?: number;
}

/**
 * Visual diagram showing all 8 gait phases as stick figures.
 * Color-coded by OGS scores when available.
 */
export const GaitPhaseDiagram = ({
  ogsLeft,
  ogsRight,
  width = 960,
  height = 260,
}: GaitPhaseDiagramProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    renderGaitPhaseStrip(canvas, ogsLeft, ogsRight);
  }, [ogsLeft, ogsRight, width, height]);

  return (
    <div className="card" style={{ padding: '0.5rem', overflow: 'auto' }}>
      <h3 style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
        Fases del Ciclo de Marcha
      </h3>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '300px',
          borderRadius: '8px',
          border: '1px solid var(--border, #e5e7eb)',
        }}
      />
      <p className="helper-text" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
        Perry & Burnfield (2010). Verde=normal, amarillo=leve, rojo=severo.
      </p>
    </div>
  );
};
