import * as tf from '@tensorflow/tfjs';
import type { AdvancedMetrics, PatternFlag, PatternStatus } from '../types/session.ts';

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

  constructor() {
    this.initializeModel();
  }

  private async initializeModel(): Promise<void> {
    try {
      // Create a simple neural network for gait pattern classification
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [20], // 20 features from metrics
            units: 64,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 8, // 8 gait patterns
            activation: 'softmax'
          })
        ]
      });

      this.model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      // Initialize with pre-trained weights (in real scenario, load from server)
      await this.loadPretrainedWeights();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ML model:', error);
    }
  }

  private async loadPretrainedWeights(): Promise<void> {
    // In a real implementation, you would load weights from a server
    // For now, we'll initialize with random weights and use rule-based logic as fallback

    // Generate synthetic training data for demonstration
    const trainingData = this.generateSyntheticTrainingData();

    if (this.model && trainingData.features.length > 0) {
      const xs = tf.tensor2d(trainingData.features);
      const ys = tf.tensor2d(trainingData.labels);

      await this.model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0
      });

      xs.dispose();
      ys.dispose();
    }
  }

  private generateSyntheticTrainingData(): { features: number[][]; labels: number[][] } {
    const features: number[][] = [];
    const labels: number[][] = [];

    // Generate synthetic data for each pattern
    const patterns = [
      'normal', 'antalgic', 'trendelenburg', 'steppage',
      'parkinsonian', 'ataxic', 'hemiplegic', 'diplegic'
    ];

    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      for (let sample = 0; sample < 50; sample++) {
        const feature = this.generatePatternFeatures(patterns[patternIndex]);
        const label = new Array(8).fill(0);
        label[patternIndex] = 1;

        features.push(feature);
        labels.push(label);
      }
    }

    return { features, labels };
  }

  private generatePatternFeatures(pattern: string): number[] {
    const baseFeatures = new Array(20).fill(0);

    switch (pattern) {
      case 'antalgic':
        baseFeatures[0] = Math.random() * 0.8 + 1.0; // Speed
        baseFeatures[1] = Math.random() * 30 + 90; // Cadence
        baseFeatures[2] = Math.random() * 15 + 10; // Asymmetry %
        baseFeatures[3] = Math.random() * 0.2 + 0.3; // Step length
        break;
      case 'parkinsonian':
        baseFeatures[0] = Math.random() * 0.5 + 0.5; // Slow speed
        baseFeatures[1] = Math.random() * 20 + 110; // High cadence
        baseFeatures[2] = Math.random() * 5 + 2; // Low asymmetry
        baseFeatures[3] = Math.random() * 0.15 + 0.25; // Short steps
        break;
      case 'ataxic':
        baseFeatures[4] = Math.random() * 30 + 20; // High variability
        baseFeatures[5] = Math.random() * 0.3 + 0.4; // Wide base
        baseFeatures[6] = Math.random() * 20 + 15; // Poor stability
        break;
      default: // normal
        baseFeatures[0] = Math.random() * 0.4 + 1.2; // Normal speed
        baseFeatures[1] = Math.random() * 20 + 100; // Normal cadence
        baseFeatures[2] = Math.random() * 5 + 1; // Low asymmetry
        baseFeatures[3] = Math.random() * 0.2 + 0.6; // Normal step length
    }

    return baseFeatures;
  }

  public async classifyGaitPattern(metrics: AdvancedMetrics): Promise<PatternProbabilities> {
    if (!this.isInitialized || !this.model) {
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
        diplegic: probabilities[7]
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
    const confidence = 0.7;

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metrics: AdvancedMetrics,
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

      if (probability > 0.3) {
        flags.push({
          id: `ml_${pattern}`,
          label: `Patrón ${pattern} (ML)`,
          status,
          rationale: `Modelo ML detecta probabilidad ${(probability * 100).toFixed(1)}% para patrón ${pattern}.`
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