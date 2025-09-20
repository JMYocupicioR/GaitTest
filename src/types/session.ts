export type ViewMode = 'lateral' | 'frontal' | 'dual';
export type CalibrationType = 'line' | 'object' | 'none';
export type QualityLevel = 'high' | 'medium' | 'low';
export type FootSide = 'L' | 'R';

export type EventSource = 'auto' | 'manual';
export type EventType = 'heel_strike' | 'toe_off' | 'foot_flat' | 'heel_off' | 'max_knee_flexion' | 'max_hip_extension';

export interface CaptureSettings {
  viewMode: ViewMode;
  calibrationType: CalibrationType;
  distanceMeters: number | null;
  targetFps: number;
}

export interface CaptureQuality {
  fpsDetected: number | null;
  lightingScore: QualityLevel;
  issues: string[];
  confidence: QualityLevel;
  durationSeconds: number | null;
}

export interface GaitEvent {
  id: string;
  timestamp: number;
  foot: FootSide;
  type: EventType;
  source: EventSource;
  confidence: number | null;
}

export interface ObservationChecklist {
  lateralTrunkLean: boolean;
  circumduction: boolean;
  forefootInitialContact: boolean;
  limitedStepLength: boolean;
  highCadenceShortSteps: boolean;
  wideBase: boolean;
  irregularTiming: boolean;
}

// Tipo para las puntuaciones de cada ítem de la OGS (-1 a 3)
export type OGSItemScore = -1 | 0 | 1 | 2 | 3;

// Interfaz para almacenar las puntuaciones OGS de una pierna
export interface OGSScore {
  initialFootContact: OGSItemScore | null;
  loadingResponse: OGSItemScore | null;
  midStance: OGSItemScore | null;
  terminalStance: OGSItemScore | null;
  preSwing: OGSItemScore | null;
  initialSwing: OGSItemScore | null;
  midSwing: OGSItemScore | null;
  terminalSwing: OGSItemScore | null;
}

// Análisis completo de la OGS
export interface OGSAnalysis {
  leftScore: OGSScore | null;
  rightScore: OGSScore | null;
  leftTotal: number | null;
  rightTotal: number | null;
  asymmetryIndex: number | null;
  qualityIndex: number | null;
  interpretations: string[];
  recommendations: string[];
  correlationWithKinematics: CorrelationAnalysis[];
}

export interface CorrelationAnalysis {
  parameter: string;
  ogsItem: keyof OGSScore;
  foot: FootSide;
  correlation: 'positive' | 'negative' | 'none';
  significance: 'high' | 'medium' | 'low';
  description: string;
}

export interface SessionMetrics {
  durationSeconds: number | null;
  steps: number;
  speedMps: number | null;
  cadenceSpm: number | null;
  stepLengthMeters: number | null;
  leftStepLengthMeters: number | null;
  rightStepLengthMeters: number | null;
  stanceTimeLeft: number | null;
  stanceTimeRight: number | null;
  stanceAsymmetryPct: number | null;
}

export interface AdvancedMetrics extends SessionMetrics {
  // Variabilidad temporal
  stepTimeVariability: number | null; // CV de intervalos entre pasos
  doubleSupport: number | null; // Tiempo de doble apoyo
  strideLength: number | null; // Longitud de zancada

  // Métricas espaciales
  stepWidth: number | null; // Ancho de base
  footAngle: number | null; // Ángulo del pie al contacto

  // Análisis de fase
  swingPhase: number | null; // % de ciclo en swing
  stancePhase: number | null; // % de ciclo en stance

  // Smoothness y estabilidad
  harmonicRatio: number | null; // Suavidad del movimiento
  accelerationVariability: number | null;
  gaitSymmetryIndex: number | null; // Índice de simetría general

  // Ángulos articulares promedio
  leftKneeAngle: number | null;
  rightKneeAngle: number | null;
  leftHipAngle: number | null;
  rightHipAngle: number | null;

  // Métricas de estabilidad
  centerOfMassVariability: number | null;
  lateralStability: number | null;
}

export type PatternStatus =
  | 'likely'
  | 'possible'
  | 'unlikely'
  | 'insufficient_data'
  | 'not_assessed';

export interface PatternFlag {
  id: string;
  label: string;
  status: PatternStatus;
  rationale: string;
}

export interface ReportSummary {
  trafficLight: 'green' | 'yellow' | 'red';
  notes: string;
  pdfUrl: string | null;
}

export interface SessionData {
  sessionId: string;
  createdAtIso: string;
  captureSettings: CaptureSettings;
  quality: CaptureQuality;
  events: GaitEvent[];
  observations: ObservationChecklist;
  metrics: SessionMetrics;
  patternFlags: PatternFlag[];
  report: ReportSummary;
  ogs: OGSAnalysis | null;
  patient?: {
    name?: string;
    identifier?: string;
    age?: number;
    height?: number;
    weight?: number;
    clinicianNote?: string;
  };
  videoBlob?: Blob;
  // Enhanced analysis fields
  advancedMetrics?: AdvancedMetrics;
  poseFrames?: any[];
  enhancedAnalysisResult?: any;
}

export const DEFAULT_OBSERVATIONS: ObservationChecklist = {
  lateralTrunkLean: false,
  circumduction: false,
  forefootInitialContact: false,
  limitedStepLength: false,
  highCadenceShortSteps: false,
  wideBase: false,
  irregularTiming: false,
};

export const DEFAULT_OGS_SCORE: OGSScore = {
  initialFootContact: null,
  loadingResponse: null,
  midStance: null,
  terminalStance: null,
  preSwing: null,
  initialSwing: null,
  midSwing: null,
  terminalSwing: null,
};

export const OGS_ITEM_LABELS: Record<keyof OGSScore, string> = {
  initialFootContact: 'Contacto Inicial del Pie',
  loadingResponse: 'Respuesta de Carga',
  midStance: 'Apoyo Medio',
  terminalStance: 'Apoyo Terminal',
  preSwing: 'Pre-Balanceo',
  initialSwing: 'Balanceo Inicial',
  midSwing: 'Balanceo Medio',
  terminalSwing: 'Balanceo Terminal',
};

export const OGS_SCORE_LABELS: Record<OGSItemScore, string> = {
  '-1': 'Muy Alterado',
  '0': 'Moderadamente Alterado',
  '1': 'Levemente Alterado',
  '2': 'Casi Normal',
  '3': 'Normal',
};
