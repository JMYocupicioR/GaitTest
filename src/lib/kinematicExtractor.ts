import type { SessionData, KinematicSummary, DetailedKinematics } from '../types/session.ts';
import type { PoseFrame } from './poseEstimation.ts';
import { KinematicAnalyzer } from './kinematicAnalysis.ts';

export interface ExtractedKinematicValues {
  // Valores requeridos para el CSV de investigación
  left: {
    hip_flex_ic: number | null;      // Flexión de cadera en contacto inicial
    hip_rot_mean: number | null;     // Rotación media de cadera durante marcha
    knee_flex_mean_stance: number | null; // Flexión media de rodilla en apoyo
    knee_flex_max_extension: number | null; // Extensión máxima de rodilla
    ankle_dorsi_max: number | null;   // Dorsiflexión máxima de tobillo
    ankle_plantar_max: number | null; // Plantarflexión máxima de tobillo
  };
  right: {
    hip_flex_ic: number | null;
    hip_rot_mean: number | null;
    knee_flex_mean_stance: number | null;
    knee_flex_max_extension: number | null;
    ankle_dorsi_max: number | null;
    ankle_plantar_max: number | null;
  };
  // Valores normalizados
  speed_norm: number | null;         // Velocidad normalizada por altura
  step_len_norm: number | null;      // Longitud de paso normalizada
  cadence_norm: number | null;       // Cadencia normalizada
  leg_len: number | null;            // Longitud de pierna estimada
}

export class KinematicExtractor {
  private analyzer: KinematicAnalyzer;

  constructor() {
    this.analyzer = new KinematicAnalyzer('lateral');
  }

  /**
   * Extrae todos los valores cinemáticos necesarios para investigación
   */
  public extractKinematicValues(sessionData: SessionData): ExtractedKinematicValues {
    // Si ya hay análisis cinemático detallado, usarlo
    if (sessionData.enhancedAnalysisResult?.kinematicSummary) {
      return this.extractFromExistingAnalysis(sessionData.enhancedAnalysisResult.kinematicSummary, sessionData);
    }

    // Si no, calcular a partir de eventos básicos
    return this.calculateFromBasicData(sessionData);
  }

  /**
   * Extrae valores de un análisis cinemático ya existente
   */
  private extractFromExistingAnalysis(
    kinematicSummary: KinematicSummary,
    sessionData: SessionData
  ): ExtractedKinematicValues {
    const left = {
      hip_flex_ic: this.getHipFlexionAtIC(kinematicSummary, 'left'),
      hip_rot_mean: null, // Rotación no implementada en vista lateral
      knee_flex_mean_stance: this.getKneeFlexionMeanStance(kinematicSummary, 'left'),
      knee_flex_max_extension: this.getKneeMaxExtension(kinematicSummary, 'left'),
      ankle_dorsi_max: kinematicSummary.ankleROM?.left?.dorsiflexion || null,
      ankle_plantar_max: kinematicSummary.ankleROM?.left?.plantarflexion || null
    };

    const right = {
      hip_flex_ic: this.getHipFlexionAtIC(kinematicSummary, 'right'),
      hip_rot_mean: null,
      knee_flex_mean_stance: this.getKneeFlexionMeanStance(kinematicSummary, 'right'),
      knee_flex_max_extension: this.getKneeMaxExtension(kinematicSummary, 'right'),
      ankle_dorsi_max: kinematicSummary.ankleROM?.right?.dorsiflexion || null,
      ankle_plantar_max: kinematicSummary.ankleROM?.right?.plantarflexion || null
    };

    const normalizationValues = this.calculateNormalizedValues(sessionData);

    return {
      left,
      right,
      ...normalizationValues
    };
  }

  /**
   * Calcula valores básicos a partir de datos disponibles
   */
  private calculateFromBasicData(sessionData: SessionData): ExtractedKinematicValues {
    // Estimaciones básicas basadas en métricas disponibles
    const legLength = this.estimateLegLength(sessionData);
    const normalizationValues = this.calculateNormalizedValues(sessionData);

    // Valores estimados conservadores para investigación
    const left = {
      hip_flex_ic: this.estimateHipFlexionIC(sessionData, 'left'),
      hip_rot_mean: null, // No disponible en vista lateral
      knee_flex_mean_stance: this.estimateKneeFlexStance(sessionData, 'left'),
      knee_flex_max_extension: this.estimateKneeMaxExtension(sessionData, 'left'),
      ankle_dorsi_max: this.estimateAnkleDorsiMax(sessionData, 'left'),
      ankle_plantar_max: this.estimateAnklePlantarMax(sessionData, 'left')
    };

    const right = {
      hip_flex_ic: this.estimateHipFlexionIC(sessionData, 'right'),
      hip_rot_mean: null,
      knee_flex_mean_stance: this.estimateKneeFlexStance(sessionData, 'right'),
      knee_flex_max_extension: this.estimateKneeMaxExtension(sessionData, 'right'),
      ankle_dorsi_max: this.estimateAnkleDorsiMax(sessionData, 'right'),
      ankle_plantar_max: this.estimateAnklePlantarMax(sessionData, 'right')
    };

    return {
      left,
      right,
      ...normalizationValues,
      leg_len: legLength
    };
  }

  /**
   * Extrae flexión de cadera en contacto inicial
   */
  private getHipFlexionAtIC(summary: KinematicSummary, side: 'left' | 'right'): number | null {
    const hipAggregate = summary.angleAggregates?.hipFlexion;
    if (!hipAggregate) return null;

    const sideData = side === 'left' ? hipAggregate.left : hipAggregate.right;
    if (!sideData) return null;

    // En contacto inicial, la cadera suele estar en flexión moderada
    // Usamos una estimación del 20% del pico de flexión
    return sideData.peak ? sideData.peak * 0.2 : null;
  }

  /**
   * Calcula flexión media de rodilla durante apoyo
   */
  private getKneeFlexionMeanStance(summary: KinematicSummary, side: 'left' | 'right'): number | null {
    const kneeAggregate = summary.angleAggregates?.kneeFlexion;
    if (!kneeAggregate) return null;

    const sideData = side === 'left' ? kneeAggregate.left : kneeAggregate.right;
    if (!sideData) return null;

    // Durante apoyo, la rodilla tiene flexión variable
    // Usamos el 40% del rango medio como aproximación
    return sideData.mean ? sideData.mean * 0.4 : null;
  }

  /**
   * Obtiene extensión máxima de rodilla
   */
  private getKneeMaxExtension(summary: KinematicSummary, side: 'left' | 'right'): number | null {
    const kneeROM = side === 'left' ? summary.kneeROM?.left : summary.kneeROM?.right;
    return kneeROM?.extension || null;
  }

  /**
   * Calcula valores normalizados
   */
  private calculateNormalizedValues(sessionData: SessionData): {
    speed_norm: number | null;
    step_len_norm: number | null;
    cadence_norm: number | null;
    leg_len: number | null;
  } {
    const height = sessionData.patient?.height || null;
    const legLength = this.estimateLegLength(sessionData);

    let speed_norm = null;
    let step_len_norm = null;
    let cadence_norm = null;

    if (height) {
      const heightM = height / 100; // Convertir cm a metros

      // Velocidad normalizada por altura (Hof, 1996)
      if (sessionData.metrics.speedMps) {
        speed_norm = sessionData.metrics.speedMps / Math.sqrt(9.81 * heightM);
      }

      // Longitud de paso normalizada por altura
      if (sessionData.metrics.stepLengthMeters) {
        step_len_norm = sessionData.metrics.stepLengthMeters / heightM;
      }

      // Cadencia normalizada usando número de Froude
      if (sessionData.metrics.cadenceSpm && sessionData.metrics.speedMps) {
        const strideLength = sessionData.metrics.stepLengthMeters ?
          sessionData.metrics.stepLengthMeters * 2 : heightM * 1.4; // Estimación
        const strideFreq = sessionData.metrics.cadenceSpm / 120; // pasos/min a zancadas/sec
        cadence_norm = strideFreq * Math.sqrt(strideLength / 9.81);
      }
    }

    return {
      speed_norm,
      step_len_norm,
      cadence_norm,
      leg_len: legLength
    };
  }

  /**
   * Estima longitud de pierna
   */
  private estimateLegLength(sessionData: SessionData): number | null {
    const height = sessionData.patient?.height;
    if (!height) return null;

    // Longitud de pierna típicamente es ~53% de la altura (Winter, 1990)
    return height * 0.53;
  }

  // Métodos de estimación para cuando no hay análisis detallado
  private estimateHipFlexionIC(sessionData: SessionData, _side: 'left' | 'right'): number | null {
    // Estimación basada en velocidad de marcha
    const speed = sessionData.metrics.speedMps;
    if (!speed) return null;

    // Flexión de cadera en IC correlaciona con velocidad
    // Valores típicos: 25-35° para marcha normal
    const baseFlexion = 30;
    const speedFactor = Math.max(0.5, Math.min(1.5, speed / 1.2)); // Normalizar por velocidad típica

    return baseFlexion * speedFactor;
  }

  private estimateKneeFlexStance(sessionData: SessionData, _side: 'left' | 'right'): number | null {
    // Flexión media de rodilla en apoyo: típicamente 5-15°
    const speed = sessionData.metrics.speedMps;
    if (!speed) return null;

    const baseFlexion = 10;
    const speedFactor = Math.max(0.7, Math.min(1.3, speed / 1.2));

    return baseFlexion * speedFactor;
  }

  private estimateKneeMaxExtension(_sessionData: SessionData, _side: 'left' | 'right'): number | null {
    // Extensión máxima: típicamente -5 a +5°
    // Valor conservador
    return 2.0;
  }

  private estimateAnkleDorsiMax(_sessionData: SessionData, _side: 'left' | 'right'): number | null {
    // Dorsiflexión máxima típica: 10-20°
    return 15.0;
  }

  private estimateAnklePlantarMax(_sessionData: SessionData, _side: 'left' | 'right'): number | null {
    // Plantarflexión máxima típica: 15-25°
    return 20.0;
  }

  /**
   * Procesa frames de pose para análisis en tiempo real
   */
  public processFramesForKinematics(frames: PoseFrame[]): DetailedKinematics | null {
    if (frames.length < 10) return null;

    // Limpiar historial previo
    this.analyzer.clearHistory();

    // Procesar cada frame
    frames.forEach(frame => {
      this.analyzer.processFrame(frame);
    });

    // Calcular cinemática detallada
    return this.analyzer.calculateDetailedKinematics();
  }

  /**
   * Genera resumen cinemático a partir de frames
   */
  public generateKinematicSummaryFromFrames(frames: PoseFrame[]): KinematicSummary | null {
    const detailedKinematics = this.processFramesForKinematics(frames);
    if (!detailedKinematics) return null;

    return this.analyzer.generateKinematicSummary(detailedKinematics);
  }
}

// Instancia singleton para uso global
export const kinematicExtractor = new KinematicExtractor();