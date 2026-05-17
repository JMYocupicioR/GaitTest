/**
 * Normative Gait Kinematic Data
 *
 * Reference values from Perry & Burnfield (2010) and Winter (1990).
 * Curves are 101-point arrays representing joint angle (°) from 0–100% of the gait cycle.
 * Each entry includes mean and ±1 SD for normative band rendering.
 *
 * Positive = flexion / dorsiflexion
 * Negative = extension / plantarflexion
 */

export interface NormativeCurve {
  /** Joint angle mean values at each % of gait cycle (101 points) */
  mean: number[];
  /** Standard deviation at each point */
  sd: number[];
  /** Upper band (mean + 1 SD) */
  upper: number[];
  /** Lower band (mean - 1 SD) */
  lower: number[];
  /** Joint name for display */
  jointName: string;
  /** Movement plane */
  plane: 'sagittal' | 'frontal';
  /** Units */
  unit: string;
}

/**
 * Generate a smooth curve from control points using cubic interpolation.
 * Control points define key values at specific gait cycle percentages.
 */
function interpolateCurve(
  controlPoints: Array<{ pct: number; value: number }>,
): number[] {
  const result = new Array<number>(101);

  for (let i = 0; i <= 100; i++) {
    // Find surrounding control points
    let lowerIdx = 0;
    for (let j = 0; j < controlPoints.length - 1; j++) {
      if (controlPoints[j].pct <= i) lowerIdx = j;
    }
    const upperIdx = Math.min(lowerIdx + 1, controlPoints.length - 1);

    const p0 = controlPoints[lowerIdx];
    const p1 = controlPoints[upperIdx];

    if (p0.pct === p1.pct) {
      result[i] = p0.value;
    } else {
      // Cosine interpolation for smooth curves
      const t = (i - p0.pct) / (p1.pct - p0.pct);
      const mu = (1 - Math.cos(t * Math.PI)) / 2;
      result[i] = p0.value * (1 - mu) + p1.value * mu;
    }
  }

  return result;
}

/**
 * Generate a constant SD array of given value for 101 points.
 */
function constantSD(value: number): number[] {
  return new Array(101).fill(value);
}

/**
 * Build a NormativeCurve from mean curve and SD array.
 */
function buildCurve(
  mean: number[],
  sd: number[],
  jointName: string,
  plane: 'sagittal' | 'frontal' = 'sagittal',
): NormativeCurve {
  const upper = mean.map((m, i) => m + sd[i]);
  const lower = mean.map((m, i) => m - sd[i]);
  return { mean, sd, upper, lower, jointName, plane, unit: '°' };
}

// ═══════════════════════════════════════════════════════════════
// HIP FLEXION/EXTENSION — Sagittal Plane
// Normal ROM: ~30° extension to ~35° flexion
// ═══════════════════════════════════════════════════════════════

const hipFlexExtMean = interpolateCurve([
  { pct: 0, value: 30 },    // IC: ~30° flexion
  { pct: 8, value: 25 },    // LR: reducing flexion
  { pct: 15, value: 15 },   // Early MSt
  { pct: 30, value: 0 },    // MSt: neutral
  { pct: 40, value: -5 },   // Late MSt
  { pct: 50, value: -10 },  // TSt: max extension
  { pct: 60, value: 0 },    // PSw: returning to neutral
  { pct: 73, value: 25 },   // ISw: peak flexion approaching
  { pct: 80, value: 35 },   // MSw: peak flexion
  { pct: 87, value: 33 },   // TSw: slight reduction
  { pct: 100, value: 30 },  // Next IC
]);

const hipFlexExtSD = constantSD(5);

// ═══════════════════════════════════════════════════════════════
// KNEE FLEXION/EXTENSION — Sagittal Plane
// Normal ROM: ~0° extension to ~60° flexion in swing
// ═══════════════════════════════════════════════════════════════

const kneeFlexExtMean = interpolateCurve([
  { pct: 0, value: 5 },     // IC: near full extension
  { pct: 8, value: 10 },    // LR: absorption flexion begins
  { pct: 15, value: 18 },   // Peak loading response flexion
  { pct: 25, value: 10 },   // Early MSt: extending
  { pct: 40, value: 3 },    // MSt: near full extension
  { pct: 50, value: 5 },    // TSt
  { pct: 60, value: 35 },   // PSw: rapid flexion begins
  { pct: 70, value: 60 },   // ISw: peak flexion
  { pct: 80, value: 45 },   // MSw: extending
  { pct: 90, value: 15 },   // TSw: approaching extension
  { pct: 100, value: 5 },   // Next IC
]);

const kneeFlexExtSD = constantSD(6);

// ═══════════════════════════════════════════════════════════════
// ANKLE DORSI/PLANTARFLEXION — Sagittal Plane
// Normal ROM: ~15° dorsiflexion to ~20° plantarflexion
// ═══════════════════════════════════════════════════════════════

const ankleDorsiPlantarMean = interpolateCurve([
  { pct: 0, value: 0 },     // IC: neutral
  { pct: 8, value: -5 },    // LR: plantarflexion (foot flat)
  { pct: 12, value: -8 },   // Peak initial plantarflexion
  { pct: 20, value: 0 },    // Foot flat, returning to neutral
  { pct: 30, value: 5 },    // MSt: dorsiflexion begins
  { pct: 40, value: 10 },   // Late MSt: increasing dorsiflexion
  { pct: 48, value: 12 },   // Peak dorsiflexion
  { pct: 55, value: 5 },    // TSt: reducing
  { pct: 62, value: -15 },  // PSw: rapid plantarflexion (push-off)
  { pct: 66, value: -20 },  // Peak plantarflexion (toe-off)
  { pct: 73, value: -5 },   // ISw: returning to neutral
  { pct: 80, value: 0 },    // MSw: neutral
  { pct: 90, value: 0 },    // TSw: neutral to slight dorsi
  { pct: 100, value: 0 },   // Next IC
]);

const ankleSD = constantSD(4);

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/** Normative hip flexion/extension curve (sagittal plane) */
export const NORMATIVE_HIP_FLEXION = buildCurve(hipFlexExtMean, hipFlexExtSD, 'Cadera — Flexión/Extensión');

/** Normative knee flexion/extension curve (sagittal plane) */
export const NORMATIVE_KNEE_FLEXION = buildCurve(kneeFlexExtMean, kneeFlexExtSD, 'Rodilla — Flexión/Extensión');

/** Normative ankle dorsi/plantarflexion curve (sagittal plane) */
export const NORMATIVE_ANKLE_FLEXION = buildCurve(ankleDorsiPlantarMean, ankleSD, 'Tobillo — Dorsi/Plantarflexión');

/** All normative sagittal plane curves */
export const NORMATIVE_SAGITTAL_CURVES: NormativeCurve[] = [
  NORMATIVE_HIP_FLEXION,
  NORMATIVE_KNEE_FLEXION,
  NORMATIVE_ANKLE_FLEXION,
];

/** Gait phase boundaries as % of gait cycle (Perry & Burnfield) */
export const GAIT_PHASES = [
  { name: 'Contacto Inicial', shortName: 'CI', startPct: 0, endPct: 2, phase: 'stance' as const },
  { name: 'Respuesta de Carga', shortName: 'RC', startPct: 2, endPct: 12, phase: 'stance' as const },
  { name: 'Apoyo Medio', shortName: 'AM', startPct: 12, endPct: 31, phase: 'stance' as const },
  { name: 'Apoyo Terminal', shortName: 'AT', startPct: 31, endPct: 50, phase: 'stance' as const },
  { name: 'Pre-Balanceo', shortName: 'PB', startPct: 50, endPct: 62, phase: 'stance' as const },
  { name: 'Balanceo Inicial', shortName: 'BI', startPct: 62, endPct: 75, phase: 'swing' as const },
  { name: 'Balanceo Medio', shortName: 'BM', startPct: 75, endPct: 87, phase: 'swing' as const },
  { name: 'Balanceo Terminal', shortName: 'BT', startPct: 87, endPct: 100, phase: 'swing' as const },
] as const;

/** Normal spatiotemporal reference values for adults */
export const NORMATIVE_SPATIOTEMPORAL = {
  speed: { mean: 1.3, sd: 0.2, unit: 'm/s', label: 'Velocidad' },
  cadence: { mean: 112, sd: 10, unit: 'pasos/min', label: 'Cadencia' },
  stepLength: { mean: 0.70, sd: 0.08, unit: 'm', label: 'Long. paso' },
  strideLength: { mean: 1.40, sd: 0.15, unit: 'm', label: 'Long. zancada' },
  stancePhase: { mean: 60, sd: 2, unit: '%', label: 'Fase apoyo' },
  swingPhase: { mean: 40, sd: 2, unit: '%', label: 'Fase balanceo' },
  doubleSupport: { mean: 20, sd: 3, unit: '%', label: 'Doble apoyo' },
  asymmetry: { mean: 2, sd: 2, unit: '%', label: 'Asimetría' },
};

export interface NormativeBundle {
  sagittalCurves: NormativeCurve[];
  spatiotemporal: typeof NORMATIVE_SPATIOTEMPORAL;
  profile: 'adult_male' | 'adult_female' | 'pediatric_male' | 'pediatric_female' | 'older_adult';
}

export function getNormativeReference(patient?: {
  age?: number;
  sex?: 'male' | 'female' | 'other';
  height?: number;
}): NormativeBundle {
  const age = patient?.age ?? 35;
  const sex = patient?.sex ?? 'other';
  let profile: NormativeBundle['profile'] = 'adult_male';
  if (age < 18) {
    profile = sex === 'female' ? 'pediatric_female' : 'pediatric_male';
  } else if (age >= 65) {
    profile = 'older_adult';
  } else {
    profile = sex === 'female' ? 'adult_female' : 'adult_male';
  }

  const speedFactor =
    profile === 'older_adult' ? 0.86 :
    profile.startsWith('pediatric') ? 0.92 :
    profile === 'adult_female' ? 0.97 :
    1;
  const cadenceFactor =
    profile.startsWith('pediatric') ? 1.1 :
    profile === 'older_adult' ? 0.92 :
    1;

  return {
    sagittalCurves: NORMATIVE_SAGITTAL_CURVES,
    spatiotemporal: {
      ...NORMATIVE_SPATIOTEMPORAL,
      speed: { ...NORMATIVE_SPATIOTEMPORAL.speed, mean: Number((NORMATIVE_SPATIOTEMPORAL.speed.mean * speedFactor).toFixed(2)) },
      cadence: { ...NORMATIVE_SPATIOTEMPORAL.cadence, mean: Number((NORMATIVE_SPATIOTEMPORAL.cadence.mean * cadenceFactor).toFixed(1)) },
      stepLength: { ...NORMATIVE_SPATIOTEMPORAL.stepLength, mean: Number((NORMATIVE_SPATIOTEMPORAL.stepLength.mean * speedFactor).toFixed(2)) },
      strideLength: { ...NORMATIVE_SPATIOTEMPORAL.strideLength, mean: Number((NORMATIVE_SPATIOTEMPORAL.strideLength.mean * speedFactor).toFixed(2)) },
    },
    profile,
  };
}
