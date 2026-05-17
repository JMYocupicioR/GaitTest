import type { PoseFrame } from '../lib/poseEstimation.ts';

export type ViewMode = 'lateral' | 'frontal' | 'dual';
export type CalibrationType = 'line' | 'object' | 'manual' | 'none';
export type QualityLevel = 'high' | 'medium' | 'low';
export type FootSide = 'L' | 'R';

export type EventSource = 'auto' | 'manual';
export type EventType = 'heel_strike' | 'toe_off' | 'foot_flat' | 'heel_off' | 'max_knee_flexion' | 'max_hip_extension';
export type EventReviewStatus = 'pending' | 'confirmed' | 'rejected';
export type EventQualityFlag =
  | 'duplicate_candidate'
  | 'out_of_order'
  | 'low_confidence'
  | 'missing_toe_off'
  | 'outside_video_duration'
  | 'insufficient_alternation'
  | 'cadence_outlier';

export interface CaptureSettings {
  viewMode: ViewMode;
  calibrationType: CalibrationType;
  distanceMeters: number | null;
  targetFps: number;
  /**
   * Optional: ancho aproximado del suelo visible en el encuadre (m), para escalar posiciones
   * normalizadas de MediaPipe en el eje horizontal (p. ej. ancho de paso).
   * Si es null, se usan heurísticas legacy (p. ej. 1.8 m ≈ ancho de frame).
   */
  frameGroundWidthMeters: number | null;
  pxPerMeter: number | null;
  calibrationMethod: 'line_distance' | 'manual_click' | 'auto_object' | null;
  calibrationConfidence: number | null;
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
  reviewStatus: EventReviewStatus;
  reviewedAtIso: string | null;
  reviewedBy: string | null;
  qualityFlags: EventQualityFlag[];
  frameIndex: number | null;
  cycleId: string | null;
  clinicalNote: string | null;
  userEdited: boolean;
}

export interface EventCycleSummary {
  id: string;
  foot: FootSide;
  heelStrikeStartTs: number;
  heelStrikeEndTs: number;
  durationSeconds: number;
  toeOffCount: number;
}

export interface EventValidationSummary {
  isReady: boolean;
  issues: string[];
  warnings: string[];
  counts: {
    total: number;
    heelStrikeLeft: number;
    heelStrikeRight: number;
    toeOffLeft: number;
    toeOffRight: number;
    confirmed: number;
    rejected: number;
    pending: number;
  };
  cadenceEstimateSpm: number | null;
  meanConfidence: number | null;
  cycleCount: number;
  flaggedEventIds: string[];
  flagsByEventId: Record<string, EventQualityFlag[]>;
  cycles: EventCycleSummary[];
}

export interface ReviewSnapshot {
  validatedAtIso: string;
  eventValidation: EventValidationSummary;
  suggestedFlags: PatternFlag[];
  metricsPreview: SessionMetrics;
  ogsCompletionPct: number;
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

export interface GaitCycle {
  side: 'left' | 'right';
  startFrame: number;
  endFrame: number;
  duration: number;
  events: {
    initialContact: number;
    toeOff: number;
  };
}

export interface CompensationPattern {
  id: string;
  name: string;
  detected: boolean;
  magnitude: number;
  description: string;
}

export interface KinematicValueMoment {
  value: number;
  timestamp: number | null;
  frameIndex: number | null;
  side?: 'left' | 'right' | 'bilateral';
}

export interface KinematicJointSummary {
  peak: KinematicValueMoment | null;
  minimum: KinematicValueMoment | null;
  maximum: KinematicValueMoment | null;
  rom: number | null;
  mean: number | null;
  standardDeviation: number | null;
  normalRange?: { min: number; max: number } | null;
  normalizedCycles?: {
    mean101: number[];
    sd101: number[];
    cycleCount: number;
  } | null;
}

export interface JointAngleTimeSeries {
  frameIndices: number[];
  timestamps: number[];
  angles: number[];
  velocity: number[];
  acceleration: number[];
}

export interface SideKinematicData {
  series: JointAngleTimeSeries | null;
  summary: KinematicJointSummary | null;
}

export interface BilateralKinematicData {
  left: SideKinematicData | null;
  right: SideKinematicData | null;
  asymmetry: number | null;
}

export interface AxialKinematicData {
  series: JointAngleTimeSeries | null;
  summary: KinematicJointSummary | null;
}

export interface AngleAggregate {
  left: { peak: number | null; mean: number | null; rom: number | null };
  right: { peak: number | null; mean: number | null; rom: number | null };
}

export interface SingleAngleAggregate {
  peak: number | null;
  mean: number | null;
  rom: number | null;
}

export interface KinematicData {
  sagittal: {
    hipFlexion?: BilateralKinematicData;
    kneeFlexion?: BilateralKinematicData;
    ankleFlexion?: BilateralKinematicData;
    pelvisTilt?: AxialKinematicData | null;
    trunkFlexion?: AxialKinematicData | null;
  };
  frontal: {
    hipAbduction?: BilateralKinematicData;
    kneeAbduction?: BilateralKinematicData;
    ankleInversion?: BilateralKinematicData;
    pelvisObliquity?: AxialKinematicData | null;
    trunkLateralFlexion?: AxialKinematicData | null;
  };
}

export interface DetailedKinematics {
  ankle: {
    left: {
      dorsiplantarflexion: JointAngleTimeSeries;
      inversionEversion: JointAngleTimeSeries | null;
    };
    right: {
      dorsiplantarflexion: JointAngleTimeSeries;
      inversionEversion: JointAngleTimeSeries | null;
    };
  };
  knee: {
    left: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null;
      rotation: JointAngleTimeSeries | null;
    };
    right: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null;
      rotation: JointAngleTimeSeries | null;
    };
  };
  hip: {
    left: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null;
      rotation: JointAngleTimeSeries | null;
    };
    right: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null;
      rotation: JointAngleTimeSeries | null;
    };
  };
  pelvis: {
    tilt: JointAngleTimeSeries | null;
    obliquity: JointAngleTimeSeries | null;
    rotation: JointAngleTimeSeries | null;
  };
  trunk: {
    flexionExtension: JointAngleTimeSeries | null;
    lateralFlexion: JointAngleTimeSeries | null;
    rotation: JointAngleTimeSeries | null;
  };
}

export interface KinematicDeviation {
  joint: 'ankle' | 'knee' | 'hip' | 'pelvis' | 'trunk';
  side: 'left' | 'right' | 'bilateral';
  plane: 'sagittal' | 'frontal' | 'transverse';
  deviation: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  clinicalImplication: string;
  normalRange: { min: number; max: number };
  observedValue: number;
}

export interface KinematicSummary {
  ankleROM: {
    left: { dorsiflexion: number; plantarflexion: number };
    right: { dorsiflexion: number; plantarflexion: number };
  };
  kneeROM: {
    left: { flexion: number; extension: number };
    right: { flexion: number; extension: number };
  };
  hipROM: {
    left: { flexion: number; extension: number };
    right: { flexion: number; extension: number };
  };
  peakValues: {
    maxAnkleDF: { left: number; right: number };
    maxAnklePF: { left: number; right: number };
    maxKneeFlex: { left: number; right: number };
    maxHipExt: { left: number; right: number };
    maxHipFlex: { left: number; right: number };
  };
  peakTiming: {
    maxAnkleDFTiming: { left: number; right: number };
    maxKneeFlexTiming: { left: number; right: number };
    maxHipExtTiming: { left: number; right: number };
  };
  angleAggregates: {
    hipFlexion: AngleAggregate;
    kneeFlexion: AngleAggregate;
    ankleFlexion: AngleAggregate;
    hipAbduction: AngleAggregate | null;
    trunkFlexion: SingleAngleAggregate | null;
    pelvicObliquity: SingleAngleAggregate | null;
  };
  deviations: KinematicDeviation[];
  kinematicQualityScore: number;
  kinematicData: KinematicData;
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

/** Resumen clínico unificado para UI, PDF y persistencia (misma fuente que MedicalReportGenerator). */
export interface ClinicalAnalysisSnapshot {
  schemaVersion: '1.0';
  generatedAtIso: string;
  primaryDiagnosis: string;
  severity: 'mild' | 'moderate' | 'severe';
  fallRiskCategory: 'low' | 'moderate' | 'high' | 'very_high';
  mobilityLevel: 'independent' | 'assisted' | 'dependent';
  /** Copia alineada con pathologyAnalyzer / informe médico (evita ciclo de tipos con pathologyAnalysis.ts). */
  pathologyAnalysis: {
    primaryFindings: Array<{
      condition: string;
      confidence: number;
      evidence: string[];
      severity: 'mild' | 'moderate' | 'severe';
      recommendations: string[];
    }>;
    differentialDiagnosis: Array<{
      condition: string;
      confidence: number;
      evidence: string[];
      severity: 'mild' | 'moderate' | 'severe';
      recommendations: string[];
    }>;
    riskFactors: {
      fallRisk: number;
      mobilityLevel: 'independent' | 'assisted' | 'dependent';
      progressionRisk: number;
    };
    interventionPriorities: string[];
    monitoringParameters: string[];
  };
}

export interface SkeletonPoint3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type SegmentEndpointRef = number | [number, number];

export interface SegmentInfo {
  name: string;
  proximal: SegmentEndpointRef;
  distal: SegmentEndpointRef;
  /** Posicion del COM desde el punto proximal (0..1). */
  comLength: number;
  /** Masa relativa del segmento (0..1). */
  massPercentage: number;
}

export interface BoneStatistics {
  medianLength: number;
  stdLength: number;
  validFrameCount: number;
}

export type JointHierarchy = Record<number, number[]>;

export interface DerivedBiometrics {
  effectiveHeightCm: number;
  estimatedHeightCm?: number;
  heightSource: 'manual' | 'estimated';
  heightConfidence: number;
  legLengthCm: number;
  bmi: number | null;
  weightKg: number | null;
  frameGroundWidthMeters: number | null;
  pxPerMeter: number | null;
  segmentMassesKg: Record<string, number> | null;
}

export interface ProcessedSkeleton {
  frames: PoseFrame[];
  segmentCOM: Record<string, Array<SkeletonPoint3D | null>>;
  totalCOM: Array<SkeletonPoint3D | null>;
  boneStats: Record<string, BoneStatistics>;
  landmarkQualityScores: number[][];
  frameQualityScores: number[];
}

/**
 * Definiciones antropometricas simplificadas (Winter 1990) adaptadas a MediaPipe Pose.
 * Los porcentajes se normalizan en runtime segun segmentos visibles.
 */
export const MEDIAPIPE_SEGMENTS_WINTER: SegmentInfo[] = [
  { name: 'left_upper_arm', proximal: 11, distal: 13, comLength: 0.436, massPercentage: 0.028 },
  { name: 'right_upper_arm', proximal: 12, distal: 14, comLength: 0.436, massPercentage: 0.028 },
  { name: 'left_forearm', proximal: 13, distal: 15, comLength: 0.430, massPercentage: 0.016 },
  { name: 'right_forearm', proximal: 14, distal: 16, comLength: 0.430, massPercentage: 0.016 },
  { name: 'left_thigh', proximal: 23, distal: 25, comLength: 0.433, massPercentage: 0.10 },
  { name: 'right_thigh', proximal: 24, distal: 26, comLength: 0.433, massPercentage: 0.10 },
  { name: 'left_shank', proximal: 25, distal: 27, comLength: 0.433, massPercentage: 0.0465 },
  { name: 'right_shank', proximal: 26, distal: 28, comLength: 0.433, massPercentage: 0.0465 },
  { name: 'left_foot', proximal: 27, distal: 31, comLength: 0.50, massPercentage: 0.0145 },
  { name: 'right_foot', proximal: 28, distal: 32, comLength: 0.50, massPercentage: 0.0145 },
  { name: 'trunk', proximal: [23, 24], distal: [11, 12], comLength: 0.50, massPercentage: 0.497 },
  { name: 'head_neck', proximal: [11, 12], distal: 0, comLength: 0.50, massPercentage: 0.081 },
];

export interface SessionData {
  sessionId: string;
  complementarySessionId?: string | null;
  createdAtIso: string;
  captureSettings: CaptureSettings;
  quality: CaptureQuality;
  events: GaitEvent[];
  eventValidation: EventValidationSummary | null;
  reviewSnapshot?: ReviewSnapshot;
  observations: ObservationChecklist;
  metrics: SessionMetrics;
  patternFlags: PatternFlag[];
  report: ReportSummary;
  ogs: OGSAnalysis | null;
  patient?: {
    name?: string;
    identifier?: string;
    age?: number;
    sex?: 'male' | 'female' | 'other';
    height?: number;
    estimatedHeight?: number;
    heightSource?: 'manual' | 'estimated';
    weight?: number;
    clinicianNote?: string;
  };
  derivedBiometrics?: DerivedBiometrics;
  videoBlob?: Blob;
  // Enhanced analysis fields
  advancedMetrics?: AdvancedMetrics;
  poseFrames?: PoseFrame[];
  processedSkeleton?: ProcessedSkeleton;
  clinicalAnalysisSnapshot?: ClinicalAnalysisSnapshot /** Snapshot post finalizeAnalysis; misma base que PDF/BD */;
  enhancedAnalysisResult?: {
    pathologyAnalysis?: ClinicalAnalysisSnapshot['pathologyAnalysis'];
    kinematicSummary?: KinematicSummary;
    processedSkeleton?: ProcessedSkeleton;
    kinematicValues?: {
      left: {
        hip_flex_ic: number | null;
        hip_rot_mean: number | null;
        knee_flex_mean_stance: number | null;
        knee_flex_max_extension: number | null;
        ankle_dorsi_max: number | null;
        ankle_plantar_max: number | null;
      };
      right: {
        hip_flex_ic: number | null;
        hip_rot_mean: number | null;
        knee_flex_mean_stance: number | null;
        knee_flex_max_extension: number | null;
        ankle_dorsi_max: number | null;
        ankle_plantar_max: number | null;
      };
      speed_norm: number | null;
      step_len_norm: number | null;
      cadence_norm: number | null;
      leg_len: number | null;
    };
  };
  kinematics?: {
    summary?: KinematicSummary;
    detailed?: DetailedKinematics;
    report?: string;
  };
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
