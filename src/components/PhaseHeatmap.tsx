import { useEffect, useRef } from 'react';
import { renderPhaseHeatmap } from '../lib/advancedCharts.ts';
import type { KinematicSummary } from '../types/session.ts';

interface PhaseHeatmapProps {
  summary?: KinematicSummary;
}

export const PhaseHeatmap = ({ summary }: PhaseHeatmapProps) => {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const url = renderPhaseHeatmap(summary, 560, 220);
    if (ref.current) ref.current.src = url;
  }, [summary]);

  return (
    <img
      ref={ref}
      alt="Heatmap articular por fase"
      style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb' }}
    />
  );
};
