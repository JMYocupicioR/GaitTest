import type {
  EventCycleSummary,
  EventQualityFlag,
  EventReviewStatus,
  EventType,
  GaitEvent,
  SessionData,
  EventValidationSummary,
} from '../types/session.ts';

export interface EventValidationOptions {
  durationSeconds: number | null;
  minHeelStrikesPerFoot?: number;
  duplicateWindowSeconds?: number;
  lowConfidenceThreshold?: number;
  maxEventsPerSecond?: number;
  maxCadenceSpm?: number;
}

const DEFAULT_EVENT_VALIDATION_OPTIONS = {
  minHeelStrikesPerFoot: 2,
  duplicateWindowSeconds: 0.12,
  lowConfidenceThreshold: 0.55,
  maxEventsPerSecond: 6,
  maxCadenceSpm: 160,
} as const;

export const createEventReviewDefaults = (): Pick<
  GaitEvent,
  'reviewStatus' | 'reviewedAtIso' | 'reviewedBy' | 'qualityFlags' | 'frameIndex' | 'cycleId' | 'clinicalNote' | 'userEdited'
> => ({
  reviewStatus: 'pending',
  reviewedAtIso: null,
  reviewedBy: null,
  qualityFlags: [],
  frameIndex: null,
  cycleId: null,
  clinicalNote: null,
  userEdited: false,
});

export const isEventProtectedFromAutoSync = (event: GaitEvent): boolean =>
  event.source === 'manual' ||
  event.userEdited ||
  event.reviewStatus === 'confirmed' ||
  event.reviewStatus === 'rejected' ||
  Boolean(event.clinicalNote);

export const ensureEventReviewFields = (event: GaitEvent): GaitEvent => ({
  ...createEventReviewDefaults(),
  ...event,
  qualityFlags: [...new Set(event.qualityFlags ?? [])],
});

function pushFlag(
  map: Map<string, Set<EventQualityFlag>>,
  eventId: string,
  flag: EventQualityFlag,
): void {
  const existing = map.get(eventId) ?? new Set<EventQualityFlag>();
  existing.add(flag);
  map.set(eventId, existing);
}

function isFinitePositive(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function cycleFromHeelStrikes(events: GaitEvent[]): EventCycleSummary[] {
  const cycles: EventCycleSummary[] = [];
  const heelStrikes = events
    .filter((event) => event.type === 'heel_strike' && event.reviewStatus !== 'rejected')
    .sort((a, b) => a.timestamp - b.timestamp);

  (['L', 'R'] as const).forEach((foot) => {
    const sameFoot = heelStrikes.filter((event) => event.foot === foot);
    for (let i = 0; i < sameFoot.length - 1; i += 1) {
      const start = sameFoot[i];
      const end = sameFoot[i + 1];
      const duration = end.timestamp - start.timestamp;
      if (!(duration > 0.35 && duration < 2.5)) {
        continue;
      }
      const toeOffCount = events.filter(
        (event) =>
          event.reviewStatus !== 'rejected' &&
          event.foot === foot &&
          event.type === 'toe_off' &&
          event.timestamp > start.timestamp &&
          event.timestamp < end.timestamp,
      ).length;
      cycles.push({
        id: `${foot}-${start.id}-${end.id}`,
        foot,
        heelStrikeStartTs: start.timestamp,
        heelStrikeEndTs: end.timestamp,
        durationSeconds: duration,
        toeOffCount,
      });
    }
  });

  return cycles.sort((a, b) => a.heelStrikeStartTs - b.heelStrikeStartTs);
}

export function validateGaitEvents(
  events: GaitEvent[],
  options: EventValidationOptions,
): EventValidationSummary {
  const config = {
    ...DEFAULT_EVENT_VALIDATION_OPTIONS,
    ...options,
  };
  const normalized = events.map(ensureEventReviewFields);
  const sorted = [...normalized].sort((a, b) => a.timestamp - b.timestamp);
  const active = sorted.filter((event) => event.reviewStatus !== 'rejected');
  const flagMap = new Map<string, Set<EventQualityFlag>>();
  const issues: string[] = [];
  const warnings: string[] = [];

  const countBy = (predicate: (event: GaitEvent) => boolean): number => active.filter(predicate).length;
  const heelStrikeLeft = countBy((event) => event.type === 'heel_strike' && event.foot === 'L');
  const heelStrikeRight = countBy((event) => event.type === 'heel_strike' && event.foot === 'R');
  const toeOffLeft = countBy((event) => event.type === 'toe_off' && event.foot === 'L');
  const toeOffRight = countBy((event) => event.type === 'toe_off' && event.foot === 'R');

  if (heelStrikeLeft < config.minHeelStrikesPerFoot) {
    issues.push('Faltan contactos iniciales de talón en pierna izquierda (mínimo 2).');
  }
  if (heelStrikeRight < config.minHeelStrikesPerFoot) {
    issues.push('Faltan contactos iniciales de talón en pierna derecha (mínimo 2).');
  }

  if (isFinitePositive(options.durationSeconds)) {
    const durationSeconds = options.durationSeconds;
    sorted.forEach((event) => {
      if (event.timestamp > durationSeconds + 0.05) {
        pushFlag(flagMap, event.id, 'outside_video_duration');
      }
    });
    if (Array.from(flagMap.values()).some((flags) => flags.has('outside_video_duration'))) {
      issues.push('Existen eventos fuera de la duración del video.');
    }
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (current.timestamp < prev.timestamp) {
      pushFlag(flagMap, current.id, 'out_of_order');
      pushFlag(flagMap, prev.id, 'out_of_order');
    }
    if (
      current.foot === prev.foot &&
      current.type === prev.type &&
      Math.abs(current.timestamp - prev.timestamp) < config.duplicateWindowSeconds
    ) {
      pushFlag(flagMap, current.id, 'duplicate_candidate');
      pushFlag(flagMap, prev.id, 'duplicate_candidate');
    }
  }

  const lowConfidenceEvents = active.filter(
    (event) => event.confidence != null && event.confidence < config.lowConfidenceThreshold,
  );
  lowConfidenceEvents.forEach((event) => pushFlag(flagMap, event.id, 'low_confidence'));
  if (lowConfidenceEvents.length > 0) {
    warnings.push(`Hay ${lowConfidenceEvents.length} eventos con confianza baja.`);
  }

  const heelStrikes = active.filter((event) => event.type === 'heel_strike').sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 1; i < heelStrikes.length; i += 1) {
    if (heelStrikes[i].foot === heelStrikes[i - 1].foot) {
      pushFlag(flagMap, heelStrikes[i].id, 'insufficient_alternation');
      pushFlag(flagMap, heelStrikes[i - 1].id, 'insufficient_alternation');
    }
  }
  if (Array.from(flagMap.values()).some((flags) => flags.has('insufficient_alternation'))) {
    warnings.push('La alternancia izquierda/derecha de contactos iniciales es irregular.');
  }

  (['L', 'R'] as const).forEach((foot) => {
    const sameFootHS = heelStrikes.filter((event) => event.foot === foot);
    for (let i = 0; i < sameFootHS.length - 1; i += 1) {
      const start = sameFootHS[i];
      const end = sameFootHS[i + 1];
      const hasToeOff = active.some(
        (event) =>
          event.foot === foot &&
          event.type === 'toe_off' &&
          event.timestamp > start.timestamp &&
          event.timestamp < end.timestamp,
      );
      if (!hasToeOff) {
        pushFlag(flagMap, start.id, 'missing_toe_off');
      }
    }
  });
  if (Array.from(flagMap.values()).some((flags) => flags.has('missing_toe_off'))) {
    warnings.push('Se detectaron ciclos sin toe-off intermedio.');
  }

  const firstTs = active[0]?.timestamp ?? null;
  const lastTs = active.at(-1)?.timestamp ?? null;
  const derivedDuration = firstTs != null && lastTs != null ? Math.max(lastTs - firstTs, 0) : null;
  const effectiveDuration = isFinitePositive(options.durationSeconds)
    ? options.durationSeconds
    : isFinitePositive(derivedDuration)
      ? derivedDuration
      : null;

  const eventsPerSecond = isFinitePositive(effectiveDuration) ? active.length / effectiveDuration : null;
  if (eventsPerSecond != null && eventsPerSecond > config.maxEventsPerSecond) {
    warnings.push(`Densidad de eventos alta (${eventsPerSecond.toFixed(1)} eventos/s).`);
    active.forEach((event) => pushFlag(flagMap, event.id, 'cadence_outlier'));
  }

  const cadenceEstimateSpm =
    isFinitePositive(derivedDuration) && heelStrikes.length > 1
      ? (heelStrikes.length / derivedDuration) * 60
      : null;
  if (cadenceEstimateSpm != null && cadenceEstimateSpm > config.maxCadenceSpm) {
    warnings.push(`Cadencia estimada fuera de rango clínico (${cadenceEstimateSpm.toFixed(0)} spm).`);
    heelStrikes.forEach((event) => pushFlag(flagMap, event.id, 'cadence_outlier'));
  }

  const duplicateCount = Array.from(flagMap.values()).filter((flags) => flags.has('duplicate_candidate')).length;
  if (duplicateCount > 0) {
    warnings.push(`Se encontraron ${duplicateCount} eventos potencialmente duplicados.`);
  }

  const cycles = cycleFromHeelStrikes(active);
  if (cycles.length < 2) {
    warnings.push('No hay suficientes ciclos completos para un análisis robusto.');
  }

  const confidenceValues = active
    .map((event) => event.confidence)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const meanConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null;

  const flagsByEventId: Record<string, EventQualityFlag[]> = {};
  flagMap.forEach((flags, eventId) => {
    flagsByEventId[eventId] = [...flags];
  });
  const flaggedEventIds = Object.keys(flagsByEventId);

  const isReady =
    issues.length === 0 &&
    heelStrikeLeft >= config.minHeelStrikesPerFoot &&
    heelStrikeRight >= config.minHeelStrikesPerFoot &&
    cycles.length > 0;

  const countReviewStatus = (status: EventReviewStatus) => sorted.filter((event) => event.reviewStatus === status).length;

  return {
    isReady,
    issues,
    warnings,
    counts: {
      total: sorted.length,
      heelStrikeLeft,
      heelStrikeRight,
      toeOffLeft,
      toeOffRight,
      confirmed: countReviewStatus('confirmed'),
      rejected: countReviewStatus('rejected'),
      pending: countReviewStatus('pending'),
    },
    cadenceEstimateSpm,
    meanConfidence,
    cycleCount: cycles.length,
    flaggedEventIds,
    flagsByEventId,
    cycles,
  };
}

export const getEventLabel = (type: EventType): string => {
  const labels: Record<EventType, string> = {
    heel_strike: 'Contacto inicial (talón)',
    toe_off: 'Despegue de dedos (toe-off)',
    foot_flat: 'Pie plano',
    heel_off: 'Despegue de talón',
    max_knee_flexion: 'Máxima flexión de rodilla',
    max_hip_extension: 'Máxima extensión de cadera',
  };
  return labels[type];
};

export const getValidatedEventsForExport = (session: SessionData): GaitEvent[] =>
  session.events
    .map(ensureEventReviewFields)
    .filter((event) => event.reviewStatus !== 'rejected')
    .sort((a, b) => a.timestamp - b.timestamp);
