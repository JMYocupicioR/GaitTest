import { useEffect, useRef } from 'react';
import { renderSymmetryRadarChart } from '../lib/advancedCharts.ts';
import type { SymmetryRadarData } from '../lib/symmetryRadar.ts';

interface SymmetryRadarChartProps {
  data: SymmetryRadarData;
}

export const SymmetryRadarChart = ({ data }: SymmetryRadarChartProps) => {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const url = renderSymmetryRadarChart(data);
    if (ref.current) ref.current.src = url;
  }, [data]);

  return (
    <img
      ref={ref}
      alt="Radar de simetría"
      style={{ width: '100%', maxWidth: 360, borderRadius: '8px', border: '1px solid #e5e7eb' }}
    />
  );
};
