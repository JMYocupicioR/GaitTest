import type { SessionMetrics } from '../types/session.ts';

interface MetricInputs {
  events: Array<{
    foot: 'L' | 'R';
    timestamp: number;
    type?: 'heel_strike' | 'toe_off' | string;
  }>;
  distanceMeters: number | null;
  durationSeconds: number | null;
}

const average = (values: number[]): number | null => {
  if (!values.length) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
};

export const computeMetrics = ({ events, distanceMeters, durationSeconds }: MetricInputs): SessionMetrics => {
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const heelStrikes = sortedEvents.filter((event) => !event.type || event.type === 'heel_strike');
  const toeOffs = sortedEvents.filter((event) => event.type === 'toe_off');
  const steps = heelStrikes.length;

  const firstTimestamp = heelStrikes.at(0)?.timestamp ?? sortedEvents.at(0)?.timestamp ?? null;
  const lastTimestamp = heelStrikes.at(-1)?.timestamp ?? sortedEvents.at(-1)?.timestamp ?? null;

  const derivedDuration =
    firstTimestamp !== null && lastTimestamp !== null ? Math.max(lastTimestamp - firstTimestamp, 0) : null;

  const effectiveDuration = durationSeconds ?? derivedDuration;

  const speedMps =
    distanceMeters && effectiveDuration && effectiveDuration > 0
      ? distanceMeters / effectiveDuration
      : null;

  const cadenceSpm = effectiveDuration && effectiveDuration > 0 ? (steps / effectiveDuration) * 60 : null;

  const stepIntervals: Array<{
    foot: 'L' | 'R';
    delta: number;
  }> = [];

  for (let i = 1; i < heelStrikes.length; i += 1) {
    const current = heelStrikes[i];
    const prev = heelStrikes[i - 1];
    const delta = current.timestamp - prev.timestamp;
    if (delta > 0.05) {
      stepIntervals.push({ foot: current.foot, delta });
    }
  }

  const leftIntervals = stepIntervals.filter((item) => item.foot === 'L').map((item) => item.delta);
  const rightIntervals = stepIntervals.filter((item) => item.foot === 'R').map((item) => item.delta);

  const averageLeftStepTime = average(leftIntervals);
  const averageRightStepTime = average(rightIntervals);
  const averageStepTime = average(stepIntervals.map((item) => item.delta));

  const leftStepLengthMeters = speedMps && averageLeftStepTime ? speedMps * averageLeftStepTime : null;
  const rightStepLengthMeters = speedMps && averageRightStepTime ? speedMps * averageRightStepTime : null;
  const stepLengthMeters = speedMps && averageStepTime ? speedMps * averageStepTime : null;

  const stanceDurationsLeft: number[] = [];
  const stanceDurationsRight: number[] = [];

  heelStrikes.forEach((event, index) => {
    const nextOpposite = heelStrikes.slice(index + 1).find((candidate) => candidate.foot !== event.foot);
    if (!nextOpposite) {
      return;
    }
    const delta = nextOpposite.timestamp - event.timestamp;
    if (delta <= 0) {
      return;
    }
    if (event.foot === 'L') {
      stanceDurationsLeft.push(delta);
    } else {
      stanceDurationsRight.push(delta);
    }
  });

  // Prefer stance time derived from ipsilateral IC -> TO pairs.
  const icToToByFoot = { L: [] as number[], R: [] as number[] };
  for (const ic of heelStrikes) {
    const nextToeOff = toeOffs.find((toe) => toe.foot === ic.foot && toe.timestamp > ic.timestamp);
    if (!nextToeOff) continue;
    const sameFootNextIc = heelStrikes.find(
      (hs) => hs.foot === ic.foot && hs.timestamp > ic.timestamp,
    );
    if (sameFootNextIc && nextToeOff.timestamp >= sameFootNextIc.timestamp) {
      continue;
    }
    const delta = nextToeOff.timestamp - ic.timestamp;
    if (delta > 0) {
      icToToByFoot[ic.foot].push(delta);
    }
  }

  const fallbackStanceLeft = average(stanceDurationsLeft);
  const fallbackStanceRight = average(stanceDurationsRight);
  const stanceTimeLeft = average(icToToByFoot.L) ?? fallbackStanceLeft;
  const stanceTimeRight = average(icToToByFoot.R) ?? fallbackStanceRight;

  let stanceAsymmetryPct: number | null = null;
  if (stanceTimeLeft && stanceTimeRight) {
    const mean = (stanceTimeLeft + stanceTimeRight) / 2;
    if (mean > 0) {
      stanceAsymmetryPct = (Math.abs(stanceTimeLeft - stanceTimeRight) / mean) * 100;
    }
  }

  return {
    durationSeconds: effectiveDuration ?? null,
    steps,
    speedMps,
    cadenceSpm,
    stepLengthMeters,
    leftStepLengthMeters,
    rightStepLengthMeters,
    stanceTimeLeft,
    stanceTimeRight,
    stanceAsymmetryPct,
  };
};
