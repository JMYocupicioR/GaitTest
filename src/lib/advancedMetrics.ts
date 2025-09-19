import type { AdvancedMetrics, GaitEvent } from '../types/session.ts';
import type { PoseFrame } from './poseEstimation.ts';

interface AdvancedMetricInputs {
  events: GaitEvent[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  poseFrames?: PoseFrame[];
  baseMetrics: {
    speedMps: number | null;
    cadenceSpm: number | null;
    stepLengthMeters: number | null;
    leftStepLengthMeters: number | null;
    rightStepLengthMeters: number | null;
    stanceTimeLeft: number | null;
    stanceTimeRight: number | null;
    stanceAsymmetryPct: number | null;
  };
}

const calculateVariability = (values: number[]): number | null => {
  if (values.length < 3) return null;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);

  // Coefficient of variation
  return mean === 0 ? null : (standardDeviation / mean) * 100;
};

const calculateHarmonicRatio = (accelerations: number[]): number | null => {
  if (accelerations.length < 10) return null;

  // Simplified harmonic ratio calculation
  const smoothAccelerations = accelerations.filter(acc => Math.abs(acc) < 10); // Remove outliers
  const variability = calculateVariability(smoothAccelerations);

  return variability ? Math.max(0, 100 - variability) : null;
};

const calculateStepWidth = (poseFrames: PoseFrame[]): number | null => {
  if (poseFrames.length < 5) return null;

  const widths: number[] = [];

  for (const frame of poseFrames) {
    if (frame.leftAnkle.visibility > 0.7 && frame.rightAnkle.visibility > 0.7) {
      const width = Math.abs(frame.leftAnkle.x - frame.rightAnkle.x);
      widths.push(width);
    }
  }

  if (widths.length === 0) return null;

  const avgWidth = widths.reduce((sum, w) => sum + w, 0) / widths.length;
  // Convert normalized coordinates to approximate meters (assuming 640px ≈ 1.8m frame width)
  return avgWidth * 1.8;
};

const calculateCenterOfMassVariability = (poseFrames: PoseFrame[]): number | null => {
  if (poseFrames.length < 10) return null;

  const comPositions: { x: number; y: number }[] = [];

  for (const frame of poseFrames) {
    if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
      const comX = (frame.leftHip.x + frame.rightHip.x) / 2;
      const comY = (frame.leftHip.y + frame.rightHip.y) / 2;
      comPositions.push({ x: comX, y: comY });
    }
  }

  if (comPositions.length < 5) return null;

  const xVariations = comPositions.map(pos => pos.x);
  const yVariations = comPositions.map(pos => pos.y);

  const xVariability = calculateVariability(xVariations) || 0;
  const yVariability = calculateVariability(yVariations) || 0;

  return Math.sqrt(xVariability * xVariability + yVariability * yVariability);
};

const calculateGaitPhases = (events: GaitEvent[], durationSeconds: number | null): {
  swingPhase: number | null;
  stancePhase: number | null;
  doubleSupport: number | null;
} => {
  if (events.length < 4 || !durationSeconds) {
    return { swingPhase: null, stancePhase: null, doubleSupport: null };
  }

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  let totalStanceTime = 0;
  let totalSwingTime = 0;
  let totalDoubleSupport = 0;
  let cycles = 0;

  for (let i = 0; i < sortedEvents.length - 2; i++) {
    const current = sortedEvents[i];
    const nextOpposite = sortedEvents.slice(i + 1).find(e => e.foot !== current.foot);
    const nextSame = sortedEvents.slice(i + 1).find(e => e.foot === current.foot);

    if (nextOpposite && nextSame) {
      const stanceTime = nextOpposite.timestamp - current.timestamp;
      const cycleTime = nextSame.timestamp - current.timestamp;
      const swingTime = cycleTime - stanceTime;

      if (stanceTime > 0 && swingTime > 0 && cycleTime > 0) {
        totalStanceTime += stanceTime;
        totalSwingTime += swingTime;

        // Double support is approximately 20% of stance phase
        totalDoubleSupport += stanceTime * 0.2;
        cycles++;
      }
    }
  }

  if (cycles === 0) return { swingPhase: null, stancePhase: null, doubleSupport: null };

  const avgCycleTime = (totalStanceTime + totalSwingTime) / cycles;

  return {
    stancePhase: (totalStanceTime / cycles / avgCycleTime) * 100,
    swingPhase: (totalSwingTime / cycles / avgCycleTime) * 100,
    doubleSupport: (totalDoubleSupport / cycles)
  };
};

export const computeAdvancedMetrics = (inputs: AdvancedMetricInputs): AdvancedMetrics => {
  const { events, durationSeconds, poseFrames = [], baseMetrics } = inputs;

  // Basic metrics from input
  const basicMetrics = {
    durationSeconds,
    steps: events.length,
    speedMps: baseMetrics.speedMps,
    cadenceSpm: baseMetrics.cadenceSpm,
    stepLengthMeters: baseMetrics.stepLengthMeters,
    leftStepLengthMeters: baseMetrics.leftStepLengthMeters,
    rightStepLengthMeters: baseMetrics.rightStepLengthMeters,
    stanceTimeLeft: baseMetrics.stanceTimeLeft,
    stanceTimeRight: baseMetrics.stanceTimeRight,
    stanceAsymmetryPct: baseMetrics.stanceAsymmetryPct
  };

  // Calculate step time intervals for variability
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const stepIntervals: number[] = [];

  for (let i = 1; i < sortedEvents.length; i++) {
    const interval = sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
    if (interval > 0.1 && interval < 3.0) { // Reasonable step time range
      stepIntervals.push(interval);
    }
  }

  // Variability metrics
  const stepTimeVariability = calculateVariability(stepIntervals);

  // Gait phases
  const phases = calculateGaitPhases(events, durationSeconds);

  // Stride length (2 steps)
  const strideLength = baseMetrics.stepLengthMeters ? baseMetrics.stepLengthMeters * 2 : null;

  // Spatial metrics from pose data
  const stepWidth = calculateStepWidth(poseFrames);
  const centerOfMassVariability = calculateCenterOfMassVariability(poseFrames);

  // Joint angles from pose data
  let avgLeftKneeAngle: number | null = null;
  let avgRightKneeAngle: number | null = null;
  const avgLeftHipAngle: number | null = null;
  const avgRightHipAngle: number | null = null;

  if (poseFrames.length > 0) {
    const leftKneeAngles: number[] = [];
    const rightKneeAngles: number[] = [];

    for (const frame of poseFrames) {
      // Calculate angles for each frame
      const leftKneeAngle = calculateAngle(frame.leftHip, frame.leftKnee, frame.leftAnkle);
      const rightKneeAngle = calculateAngle(frame.rightHip, frame.rightKnee, frame.rightAnkle);

      if (leftKneeAngle > 0) leftKneeAngles.push(leftKneeAngle);
      if (rightKneeAngle > 0) rightKneeAngles.push(rightKneeAngle);
    }

    avgLeftKneeAngle = leftKneeAngles.length > 0 ?
      leftKneeAngles.reduce((sum, a) => sum + a, 0) / leftKneeAngles.length : null;
    avgRightKneeAngle = rightKneeAngles.length > 0 ?
      rightKneeAngles.reduce((sum, a) => sum + a, 0) / rightKneeAngles.length : null;
  }

  // Gait symmetry index
  let gaitSymmetryIndex: number | null = null;
  if (baseMetrics.leftStepLengthMeters && baseMetrics.rightStepLengthMeters &&
      baseMetrics.stanceTimeLeft && baseMetrics.stanceTimeRight) {
    const stepSymmetry = Math.abs(baseMetrics.leftStepLengthMeters - baseMetrics.rightStepLengthMeters) /
      ((baseMetrics.leftStepLengthMeters + baseMetrics.rightStepLengthMeters) / 2);
    const timeSymmetry = Math.abs(baseMetrics.stanceTimeLeft - baseMetrics.stanceTimeRight) /
      ((baseMetrics.stanceTimeLeft + baseMetrics.stanceTimeRight) / 2);

    gaitSymmetryIndex = (stepSymmetry + timeSymmetry) / 2 * 100;
  }

  // Harmonic ratio (movement smoothness)
  const accelerations = calculateAccelerations(poseFrames);
  const harmonicRatio = calculateHarmonicRatio(accelerations);

  // Acceleration variability
  const accelerationVariability = calculateVariability(accelerations);

  // Lateral stability
  const lateralStability = centerOfMassVariability ? Math.max(0, 100 - centerOfMassVariability * 10) : null;

  return {
    ...basicMetrics,
    stepTimeVariability,
    doubleSupport: phases.doubleSupport,
    strideLength,
    stepWidth,
    footAngle: null, // Requires more complex pose analysis
    swingPhase: phases.swingPhase,
    stancePhase: phases.stancePhase,
    harmonicRatio,
    accelerationVariability,
    gaitSymmetryIndex,
    leftKneeAngle: avgLeftKneeAngle,
    rightKneeAngle: avgRightKneeAngle,
    leftHipAngle: avgLeftHipAngle,
    rightHipAngle: avgRightHipAngle,
    centerOfMassVariability,
    lateralStability
  };
};

function calculateAngle(a: { x: number; y: number; visibility: number }, b: { x: number; y: number; visibility: number }, c: { x: number; y: number; visibility: number }): number {
  if (!a || !b || !c || a.visibility < 0.7 || b.visibility < 0.7 || c.visibility < 0.7) {
    return 0;
  }

  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

function calculateAccelerations(poseFrames: PoseFrame[]): number[] {
  if (poseFrames.length < 3) return [];

  const accelerations: number[] = [];

  for (let i = 2; i < poseFrames.length; i++) {
    const prev = poseFrames[i - 2];
    const curr = poseFrames[i - 1];
    const next = poseFrames[i];

    if (curr.leftHip.visibility > 0.7 && curr.rightHip.visibility > 0.7) {
      const comX = (curr.leftHip.x + curr.rightHip.x) / 2;
      const prevComX = (prev.leftHip.x + prev.rightHip.x) / 2;
      const nextComX = (next.leftHip.x + next.rightHip.x) / 2;

      const dt = (next.timestamp - prev.timestamp) / 2;
      if (dt > 0) {
        const acceleration = (nextComX - 2 * comX + prevComX) / (dt * dt);
        accelerations.push(acceleration);
      }
    }
  }

  return accelerations;
}