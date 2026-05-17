import * as tf from '@tensorflow/tfjs';
import type { AdvancedMetrics, PatternFlag, PatternStatus } from '../types/session.ts';

/** Versión esperada del modelo exportado (documentar junto al artifact model.json). */
export const GAIT_ML_MODEL_SCHEMA_VERSION = '1.0.0';

/** Umbral mínimo de probabilidad para emitir flags ML (evita ruido). */
const ML_PATTERN_PROB_THRESHOLD = 0.35;

export interface PatternProbabilities {
  antalgic: number;
  trendelenburg: number;
  steppage: number;
  parkinsonian: number;
  ataxic: number;
  hemiplegic: number;
  diplegic: number;
  normal: number;
}

export interface AnomalyScore {
  parameter: string;
  score: number; // 0-1, where 1 is most anomalous
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface RiskScore {
  fallRisk: number; // 0-100, higher is more risk
  mobilityImpairment: number; // 0-100
  recommendation: string;
  confidence: number; // 0-1
}

export class MLPatternDetector {
  private model: tf.LayersModel | null = null;
  private isInitialized = false;
  private hasPretrainedWeights = false;

  constructor() {
    void this.initializeModel();
  }

  private async initializeModel(): Promise<void> {
    try {
      await this.loadPretrainedWeights();

      if (!this.hasPretrainedWeights) {
        // Red ligera solo para entorno sin pesos remotos (inferencia desactivada → fallback heurístico).
        this.model = tf.sequential({
          layers: [
            tf.layers.dense({
              inputShape: [20],
              units: 64,
              activation: 'relu',
            }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({
              units: 32,
              activation: 'relu',
            }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({
              units: 8,
              activation: 'softmax',
            }),
          ],
        });

        this.model.compile({
          optimizer: 'adam',
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy'],
        });
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ML model:', error);
    }
  }

  /**
   * Si existe `VITE_GAIT_ML_MODEL_URL` apuntando a un model.json de TensorFlow.js
   * (softmax 8 clases: normal, antalgic, trendelenburg, steppage, parkinsonian, ataxic, hemiplegic, diplegic),
   * se usa inferencia real; si no, `hasPretrainedWeights` queda en false y se usan reglas.
   */
  private async loadPretrainedWeights(): Promise<void> {
    const raw =
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GAIT_ML_MODEL_URL
        ? String(import.meta.env.VITE_GAIT_ML_MODEL_URL).trim()
        : '';
    if (!raw) {
      this.hasPretrainedWeights = false;
      return;
    }
    try {
      const loaded = await tf.loadLayersModel(raw);
      if (this.model) {
        this.model.dispose();
        this.model = null;
      }
      this.model = loaded;
      this.hasPretrainedWeights = true;
      console.info(`[GaitML] Model loaded (${GAIT_ML_MODEL_SCHEMA_VERSION}) from`, raw);
    } catch (e) {
      console.warn('[GaitML] VITE_GAIT_ML_MODEL_URL set but load failed; using heuristic fallback.', e);
      this.hasPretrainedWeights = false;
      this.model = null;
    }
  }

  public async classifyGaitPattern(metrics: AdvancedMetrics): Promise<PatternProbabilities> {
    if (!this.isInitialized || !this.model || !this.hasPretrainedWeights) {
      return this.fallbackClassification(metrics);
    }

    try {
      const features = this.extractFeatures(metrics);
      const featureTensor = tf.tensor2d([features]);

      const prediction = this.model.predict(featureTensor) as tf.Tensor;
      const probabilities = await prediction.data();

      featureTensor.dispose();
      prediction.dispose();

      return {
        normal: probabilities[0],
        antalgic: probabilities[1],
        trendelenburg: probabilities[2],
        steppage: probabilities[3],
        parkinsonian: probabilities[4],
        ataxic: probabilities[5],
        hemiplegic: probabilities[6],
        diplegic: probabilities[7],
      };
    } catch (error) {
      console.error('ML classification failed, using fallback:', error);
      return this.fallbackClassification(metrics);
    }
  }

  private extractFeatures(metrics: AdvancedMetrics): number[] {
    return [
      metrics.speedMps || 0,
      metrics.cadenceSpm || 0,
      metrics.stanceAsymmetryPct || 0,
      metrics.stepLengthMeters || 0,
      metrics.stepTimeVariability || 0,
      metrics.stepWidth || 0,
      metrics.centerOfMassVariability || 0,
      metrics.harmonicRatio || 0,
      metrics.gaitSymmetryIndex || 0,
      metrics.leftKneeAngle || 0,
      metrics.rightKneeAngle || 0,
      metrics.swingPhase || 0,
      metrics.stancePhase || 0,
      metrics.lateralStability || 0,
      metrics.accelerationVariability || 0,
      metrics.doubleSupport || 0,
      metrics.strideLength || 0,
      metrics.steps,
      metrics.durationSeconds || 0,
      metrics.footAngle || 0
    ];
  }

  private fallbackClassification(metrics: AdvancedMetrics): PatternProbabilities {
    // Rule-based fallback classification
    const scores = {
      normal: 0.1,
      antalgic: 0,
      trendelenburg: 0,
      steppage: 0,
      parkinsonian: 0,
      ataxic: 0,
      hemiplegic: 0,
      diplegic: 0
    };

    // Antalgic pattern
    if (metrics.stanceAsymmetryPct && metrics.stanceAsymmetryPct > 10) {
      scores.antalgic = Math.min(1.0, metrics.stanceAsymmetryPct / 20);
    }

    // Parkinsonian pattern
    if (metrics.stepLengthMeters && metrics.cadenceSpm) {
      if (metrics.stepLengthMeters < 0.5 && metrics.cadenceSpm > 110) {
        scores.parkinsonian = 0.8;
      }
    }

    // Ataxic pattern
    if (metrics.stepTimeVariability && metrics.stepTimeVariability > 15) {
      scores.ataxic = Math.min(0.9, metrics.stepTimeVariability / 25);
    }

    // Normalize scores
    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (total > 0) {
      Object.keys(scores).forEach(key => {
        scores[key as keyof PatternProbabilities] /= total;
      });
    } else {
      scores.normal = 1.0;
    }

    return scores;
  }

  public detectAnomalies(metrics: AdvancedMetrics): AnomalyScore[] {
    const anomalies: AnomalyScore[] = [];

    // Normal ranges for gait parameters
    const normalRanges = {
      speedMps: [1.0, 1.6],
      cadenceSpm: [90, 120],
      stepLengthMeters: [0.5, 0.8],
      stanceAsymmetryPct: [0, 5],
      stepTimeVariability: [0, 10],
      stepWidth: [0.1, 0.2],
      harmonicRatio: [60, 100],
      gaitSymmetryIndex: [0, 10]
    };

    Object.entries(normalRanges).forEach(([param, [min, max]]) => {
      const value = metrics[param as keyof AdvancedMetrics] as number;

      if (value !== null && value !== undefined) {
        let score = 0;
        let severity: 'low' | 'medium' | 'high' = 'low';
        let description = '';

        if (value < min) {
          score = (min - value) / min;
          description = `${param} below normal range`;
        } else if (value > max) {
          score = (value - max) / max;
          description = `${param} above normal range`;
        }

        if (score > 0.5) severity = 'high';
        else if (score > 0.2) severity = 'medium';

        if (score > 0.1) {
          anomalies.push({
            parameter: param,
            score: Math.min(1, score),
            severity,
            description
          });
        }
      }
    });

    return anomalies.sort((a, b) => b.score - a.score);
  }

  public assessFallRisk(metrics: AdvancedMetrics): RiskScore {
    let riskScore = 0;
    let mobilityScore = 0;
    const confidence = this.hasPretrainedWeights ? 0.85 : 0.7;

    // Speed-based risk
    if (metrics.speedMps) {
      if (metrics.speedMps < 0.8) riskScore += 30;
      else if (metrics.speedMps < 1.0) riskScore += 15;
      mobilityScore += Math.max(0, 50 - (1.4 - metrics.speedMps) * 50);
    }

    // Balance and stability risk
    if (metrics.stepTimeVariability && metrics.stepTimeVariability > 15) {
      riskScore += 25;
    }

    if (metrics.centerOfMassVariability && metrics.centerOfMassVariability > 10) {
      riskScore += 20;
    }

    if (metrics.stepWidth && metrics.stepWidth > 0.25) {
      riskScore += 15; // Wide base indicates instability
    }

    // Asymmetry risk
    if (metrics.stanceAsymmetryPct && metrics.stanceAsymmetryPct > 10) {
      riskScore += 20;
    }

    // Gait pattern risk
    if (metrics.harmonicRatio && metrics.harmonicRatio < 50) {
      riskScore += 15;
    }

    riskScore = Math.min(100, riskScore);
    mobilityScore = Math.max(0, 100 - riskScore);

    let recommendation = '';
    if (riskScore > 70) {
      recommendation = 'Alto riesgo de caídas. Evaluación clínica urgente recomendada.';
    } else if (riskScore > 40) {
      recommendation = 'Riesgo moderado. Considerar fisioterapia y evaluación del equilibrio.';
    } else if (riskScore > 20) {
      recommendation = 'Riesgo bajo-moderado. Monitoreo regular recomendado.';
    } else {
      recommendation = 'Bajo riesgo de caídas. Mantener actividad física regular.';
    }

    return {
      fallRisk: riskScore,
      mobilityImpairment: 100 - mobilityScore,
      recommendation,
      confidence
    };
  }

  public generateAdvancedPatternFlags(
    _metrics: AdvancedMetrics,
    probabilities: PatternProbabilities,
    anomalies: AnomalyScore[]
  ): PatternFlag[] {
    const flags: PatternFlag[] = [];

    // Generate flags based on ML probabilities
    Object.entries(probabilities).forEach(([pattern, probability]) => {
      if (pattern === 'normal') return;

      let status: PatternStatus = 'unlikely';
      if (probability > 0.7) status = 'likely';
      else if (probability > 0.4) status = 'possible';

      if (probability > ML_PATTERN_PROB_THRESHOLD) {
        flags.push({
          id: `ml_${pattern}`,
          label: `Patrón ${pattern} (ML)`,
          status,
          rationale: `Modelo ML detecta probabilidad ${(probability * 100).toFixed(1)}% para patrón ${pattern}.`,
        });
      }
    });

    // Generate flags for significant anomalies
    anomalies.slice(0, 3).forEach((anomaly, index) => {
      if (anomaly.severity === 'high') {
        flags.push({
          id: `anomaly_${index}`,
          label: `Anomalía: ${anomaly.parameter}`,
          status: 'likely',
          rationale: anomaly.description + ` (score: ${anomaly.score.toFixed(2)})`
        });
      }
    });

    return flags;
  }
}