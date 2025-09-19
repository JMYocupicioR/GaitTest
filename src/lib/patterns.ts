import type {
  CaptureQuality,
  ObservationChecklist,
  PatternFlag,
  PatternStatus,
  SessionMetrics,
  ViewMode,
} from '../types/session.ts';

interface PatternInputs {
  metrics: SessionMetrics;
  observations: ObservationChecklist;
  viewMode: ViewMode;
  quality: CaptureQuality;
}

const describeStatus = (status: PatternStatus): string => {
  switch (status) {
    case 'likely':
      return 'Compatible con alteración marcada';
    case 'possible':
      return 'Cambios moderados, correlacionar clínicamente';
    case 'unlikely':
      return 'Dentro de variaciones esperables';
    case 'insufficient_data':
      return 'Señal insuficiente en el clip';
    case 'not_assessed':
      return 'Requiere vista o datos adicionales';
    default:
      return '';
  }
};

const buildFlag = (id: string, label: string, status: PatternStatus, rationale: string): PatternFlag => ({
  id,
  label,
  status,
  rationale,
});

export const evaluatePatterns = ({ metrics, observations, viewMode, quality }: PatternInputs): PatternFlag[] => {
  const flags: PatternFlag[] = [];

  // Antálgica
  const asym = metrics.stanceAsymmetryPct;
  if (asym === null) {
    flags.push(
      buildFlag('antalgic', 'Patrón antálgico', 'insufficient_data', 'No hay suficientes eventos para estimar la asimetría de apoyo.'),
    );
  } else {
    let status: PatternStatus = 'unlikely';
    if (asym >= 15) {
      status = 'likely';
    } else if (asym >= 10) {
      status = 'possible';
    }

    let details = `Asimetría de apoyo estimada en ${asym.toFixed(1)}%. ${describeStatus(status)}.`;
    if (metrics.leftStepLengthMeters && metrics.rightStepLengthMeters) {
      const diff = Math.abs(metrics.leftStepLengthMeters - metrics.rightStepLengthMeters);
      if (diff > 0.08) {
        details += ` Diferencia de longitud de paso ~${diff.toFixed(2)} m.`;
      }
    }

    flags.push(buildFlag('antalgic', 'Patrón antálgico', status, details));
  }

  // Trendelenburg (requiere vista frontal)
  if (viewMode !== 'frontal') {
    flags.push(
      buildFlag('trendelenburg', 'Trendelenburg', 'not_assessed', 'Se necesita captura frontal para valorar el balanceo pélvico.'),
    );
  } else {
    const status: PatternStatus = observations.lateralTrunkLean && asym && asym > 8 ? 'possible' : 'insufficient_data';
    const rationale = observations.lateralTrunkLean
      ? 'Oscilación lateral aumentada detectada. Revisar asimetría de apoyo.'
      : 'No se observó inclinación lateral relevante.';
    flags.push(buildFlag('trendelenburg', 'Trendelenburg', status, rationale));
  }

  // Steppage
  if (observations.forefootInitialContact || observations.circumduction) {
    const status: PatternStatus = observations.forefootInitialContact && observations.circumduction ? 'likely' : 'possible';
    let rationale = 'Movimiento compensatorio en fase de balanceo.';
    if (observations.forefootInitialContact) {
      rationale += ' Contacto inicial del antepié sugestivo.';
    }
    if (observations.circumduction) {
      rationale += ' Circunducción o elevación lateral observable.';
    }
    flags.push(buildFlag('steppage', 'Estepaje', status, rationale));
  } else {
    flags.push(
      buildFlag('steppage', 'Estepaje', quality.confidence === 'low' ? 'insufficient_data' : 'unlikely', 'No se observaron signos claros de foot-drop.'),
    );
  }

  // Parkinsoniana
  const shortSteps = metrics.stepLengthMeters !== null && metrics.stepLengthMeters < 0.5;
  const highCadence = metrics.cadenceSpm !== null && metrics.cadenceSpm > 110;
  if (shortSteps && highCadence) {
    const status: PatternStatus = observations.highCadenceShortSteps ? 'likely' : 'possible';
    let rationale = `Longitud de paso ${metrics.stepLengthMeters?.toFixed(2)} m y cadencia ${metrics.cadenceSpm?.toFixed(0)} spm.`;
    if (!observations.highCadenceShortSteps) {
      rationale += ' Falta confirmar braceo reducido.';
    }
    flags.push(buildFlag('parkinsonian', 'Parkinsoniana', status, rationale));
  } else if (observations.highCadenceShortSteps) {
    flags.push(
      buildFlag(
        'parkinsonian',
        'Parkinsoniana',
        'possible',
        'Usuario marcó pasos cortos con cadencia alta, revisar braceo en capturas posteriores.',
      ),
    );
  } else {
    flags.push(
      buildFlag('parkinsonian', 'Parkinsoniana', 'unlikely', 'Cadencia y longitud de paso dentro de rangos orientativos.'),
    );
  }

  // Atáxica
  if (observations.wideBase || observations.irregularTiming) {
    const status: PatternStatus = observations.irregularTiming ? 'likely' : 'possible';
    const rationale = observations.irregularTiming
      ? 'Variabilidad temporal marcada en la anotación manual.'
      : 'Base de apoyo amplia reportada.';
    flags.push(buildFlag('ataxic', 'Atáxica', status, rationale));
  } else if (stepIntervalsSparse(metrics)) {
    flags.push(
      buildFlag('ataxic', 'Atáxica', 'insufficient_data', 'Necesitamos más ciclos o anotaciones para valorar la variabilidad.'),
    );
  } else {
    flags.push(buildFlag('ataxic', 'Atáxica', 'unlikely', 'Tempos entre pasos regulares sin oscilaciones marcadas.'));
  }

  return flags;
};

const stepIntervalsSparse = (metrics: SessionMetrics): boolean => {
  if (!metrics.durationSeconds || metrics.steps < 4) {
    return true;
  }
  return false;
};
