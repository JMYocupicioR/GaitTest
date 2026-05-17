import type { SessionData } from '../types/session.ts';

export interface SymmetryRadarData {
  labels: string[];
  leftScores: number[];
  rightScores: number[];
}

function normalizePair(left: number | null | undefined, right: number | null | undefined): [number, number] {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) {
    return [0, 0];
  }
  const max = Math.max(Math.abs(left), Math.abs(right), 1e-6);
  return [(left / max) * 3, (right / max) * 3];
}

export function buildSymmetryRadar(session: SessionData): SymmetryRadarData {
  const metrics = session.metrics;
  const kin = session.enhancedAnalysisResult?.kinematicSummary?.kinematicData?.sagittal;

  const [stepLenL, stepLenR] = normalizePair(metrics.leftStepLengthMeters, metrics.rightStepLengthMeters);
  const [stanceL, stanceR] = normalizePair(metrics.stanceTimeLeft, metrics.stanceTimeRight);
  const [hipRomL, hipRomR] = normalizePair(
    kin?.hipFlexion?.left?.summary?.rom ?? null,
    kin?.hipFlexion?.right?.summary?.rom ?? null,
  );
  const [kneeRomL, kneeRomR] = normalizePair(
    kin?.kneeFlexion?.left?.summary?.rom ?? null,
    kin?.kneeFlexion?.right?.summary?.rom ?? null,
  );
  const [ankleRomL, ankleRomR] = normalizePair(
    kin?.ankleFlexion?.left?.summary?.rom ?? null,
    kin?.ankleFlexion?.right?.summary?.rom ?? null,
  );
  const [cadenceL, cadenceR] = normalizePair(metrics.cadenceSpm ?? null, metrics.cadenceSpm ?? null);

  return {
    labels: ['Long. paso', 'Tiempo apoyo', 'ROM cadera', 'ROM rodilla', 'ROM tobillo', 'Cadencia'],
    leftScores: [stepLenL, stanceL, hipRomL, kneeRomL, ankleRomL, cadenceL],
    rightScores: [stepLenR, stanceR, hipRomR, kneeRomR, ankleRomR, cadenceR],
  };
}
