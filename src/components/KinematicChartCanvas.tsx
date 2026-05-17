import { useEffect, useRef } from 'react';
import { renderKinematicChart } from '../lib/reportCharts.ts';
import { getNormativeReference } from '../lib/normativeData.ts';

interface KinematicChartCanvasProps {
  /** Index into NORMATIVE_SAGITTAL_CURVES: 0=hip, 1=knee, 2=ankle */
  jointIndex: number;
  /** Patient angle data for the left/primary side */
  patientDataLeft?: number[] | null;
  /** Patient angle data for the right/contralateral side */
  patientDataRight?: number[] | null;
  patientProfile?: { age?: number; sex?: 'male' | 'female' | 'other'; height?: number };
  width?: number;
  height?: number;
}

/**
 * Interactive kinematic angle chart with normative band overlay.
 */
export const KinematicChartCanvas = ({
  jointIndex,
  patientDataLeft,
  patientDataRight,
  patientProfile,
  width = 520,
  height = 200,
}: KinematicChartCanvasProps) => {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const normative = getNormativeReference(patientProfile).sagittalCurves[jointIndex];
    if (!normative) return;

    const dataUrl = renderKinematicChart({
      title: normative.jointName,
      normative,
      patientData: patientDataLeft,
      patientDataContralateral: patientDataRight,
      width,
      height,
    });

    if (imgRef.current) {
      imgRef.current.src = dataUrl;
    }
  }, [jointIndex, patientDataLeft, patientDataRight, patientProfile, width, height]);

  return (
    <img
      ref={imgRef}
      alt="Curva cinemática"
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: '8px',
        border: '1px solid var(--border, #e5e7eb)',
      }}
    />
  );
};
