import { computeMetrics } from './metrics.ts';
import { computeAdvancedMetrics } from './advancedMetrics.ts';
import { evaluatePatterns } from './patterns.ts';
import { MLPatternDetector } from './mlPatterns.ts';
import { KinematicAnalyzer } from './kinematicAnalysis.ts';
import type { DetailedKinematics, KinematicSummary } from '../types/session.ts';
import type {
  GaitEvent,
  CaptureSettings,
  CaptureQuality,
  ObservationChecklist,
  AdvancedMetrics,
  PatternFlag,
  SessionMetrics
} from '../types/session.ts';
import type { PoseFrame } from './poseEstimation.ts';

export interface EnhancedAnalysisInput {
  events: GaitEvent[];
  captureSettings: CaptureSettings;
  quality: CaptureQuality;
  observations: ObservationChecklist;
  poseFrames?: PoseFrame[];
}

export interface EnhancedAnalysisResult {
  basicMetrics: SessionMetrics;
  advancedMetrics: AdvancedMetrics;
  traditionalPatterns: PatternFlag[];
  mlPatterns: PatternFlag[];
  combinedPatterns: PatternFlag[];
  riskAssessment: {
    fallRisk: number;
    mobilityImpairment: number;
    recommendation: string;
    confidence: number;
  };
  detailedKinematics?: DetailedKinematics;
  kinematicSummary?: KinematicSummary;
  kinematicReport?: string;
  qualityScore: number;
  processingTime: number;
}

export class EnhancedGaitAnalyzer {
  private mlDetector: MLPatternDetector;

  constructor() {
    this.mlDetector = new MLPatternDetector();
  }

  public async performCompleteAnalysis(input: EnhancedAnalysisInput): Promise<EnhancedAnalysisResult> {
    const startTime = performance.now();

    // 1. Basic metrics calculation
    const basicMetrics = computeMetrics({
      events: input.events,
      distanceMeters: input.captureSettings.distanceMeters,
      durationSeconds: input.quality.durationSeconds
    });

    // 2. Advanced metrics calculation
    const advancedMetrics = computeAdvancedMetrics({
      events: input.events,
      distanceMeters: input.captureSettings.distanceMeters,
      durationSeconds: input.quality.durationSeconds,
      poseFrames: input.poseFrames || [],
      baseMetrics: basicMetrics
    });

    let detailedKinematics: DetailedKinematics | undefined;
    let kinematicSummary: KinematicSummary | undefined;
    let kinematicReport: string | undefined;

    if (input.poseFrames && input.poseFrames.length >= 10) {
      const kinematicAnalyzer = new KinematicAnalyzer(input.captureSettings.viewMode);
      input.poseFrames.forEach(frame => kinematicAnalyzer.processFrame(frame));
      detailedKinematics = kinematicAnalyzer.calculateDetailedKinematics();
      kinematicSummary = kinematicAnalyzer.generateKinematicSummary(detailedKinematics);
      kinematicReport = kinematicAnalyzer.generateKinematicReport(kinematicSummary);
    }

    // 3. Traditional pattern evaluation
    const traditionalPatterns = evaluatePatterns({
      metrics: basicMetrics,
      observations: input.observations,
      viewMode: input.captureSettings.viewMode,
      quality: input.quality
    });

    // 4. ML-based pattern detection
    const mlProbabilities = await this.mlDetector.classifyGaitPattern(advancedMetrics);
    const anomalies = this.mlDetector.detectAnomalies(advancedMetrics);
    const mlPatterns = this.mlDetector.generateAdvancedPatternFlags(
      advancedMetrics,
      mlProbabilities,
      anomalies
    );

    // 5. Combine traditional and ML patterns
    const combinedPatterns = this.combinePatternAnalyses(traditionalPatterns, mlPatterns);

    // 6. Risk assessment
    const riskAssessment = this.mlDetector.assessFallRisk(advancedMetrics);

    // 7. Quality assessment
    const qualityScore = this.calculateQualityScore(input.quality, input.events, input.poseFrames || []);

    const processingTime = performance.now() - startTime;

    return {
      basicMetrics,
      advancedMetrics,
      traditionalPatterns,
      mlPatterns,
      combinedPatterns,
      riskAssessment,
      detailedKinematics,
      kinematicSummary,
      kinematicReport,
      qualityScore,
      processingTime
    };
  }

  private combinePatternAnalyses(traditional: PatternFlag[], ml: PatternFlag[]): PatternFlag[] {
    const combined: PatternFlag[] = [...traditional];

    // Add ML patterns that don't conflict with traditional ones
    ml.forEach(mlPattern => {
      const traditionalEquivalent = traditional.find(t =>
        t.id.includes(mlPattern.id.replace('ml_', ''))
      );

      if (traditionalEquivalent) {
        // Combine confidence if both detect the same pattern
        if (traditionalEquivalent.status === 'likely' && mlPattern.status === 'likely') {
          traditionalEquivalent.rationale += ` Confirmado por análisis ML.`;
        } else if (traditionalEquivalent.status === 'unlikely' && mlPattern.status === 'likely') {
          traditionalEquivalent.status = 'possible';
          traditionalEquivalent.rationale += ` ML sugiere posible patrón (conflicto con análisis tradicional).`;
        }
      } else {
        // Add new ML-detected pattern
        combined.push(mlPattern);
      }
    });

    return combined;
  }

  private calculateQualityScore(
    quality: CaptureQuality,
    events: GaitEvent[],
    poseFrames: PoseFrame[]
  ): number {
    let score = 50; // Base score

    // FPS quality
    if (quality.fpsDetected) {
      if (quality.fpsDetected >= 30) score += 15;
      else if (quality.fpsDetected >= 20) score += 10;
      else if (quality.fpsDetected >= 15) score += 5;
    }

    // Duration quality
    if (quality.durationSeconds) {
      if (quality.durationSeconds >= 10) score += 15;
      else if (quality.durationSeconds >= 6) score += 10;
      else if (quality.durationSeconds >= 3) score += 5;
    }

    // Event count quality
    if (events.length >= 10) score += 10;
    else if (events.length >= 6) score += 5;

    // Pose estimation quality
    if (poseFrames.length > 0) {
      const avgVisibility = poseFrames.reduce((sum, frame) => {
        const relevantLandmarks = [
          frame.leftAnkle, frame.rightAnkle,
          frame.leftKnee, frame.rightKnee,
          frame.leftHip, frame.rightHip
        ];
        const avgVis = relevantLandmarks.reduce((s, landmark) => s + landmark.visibility, 0) / relevantLandmarks.length;
        return sum + avgVis;
      }, 0) / poseFrames.length;

      score += Math.round(avgVisibility * 10);
    }

    // Lighting and general quality
    switch (quality.lightingScore) {
      case 'high': score += 5; break;
      case 'medium': score += 2; break;
      case 'low': score -= 5; break;
    }

    // Issues penalty
    score -= quality.issues.length * 3;

    return Math.max(0, Math.min(100, score));
  }

  public generateEnhancedReport(result: EnhancedAnalysisResult): {
    summary: string;
    keyFindings: string[];
    recommendations: string[];
    technicalNotes: string[];
  } {
    const { advancedMetrics, combinedPatterns, riskAssessment, qualityScore } = result;

    // Generate summary
    let summary = `Análisis completo de marcha con ${result.basicMetrics.steps} pasos detectados.`;

    if (advancedMetrics.speedMps) {
      summary += ` Velocidad: ${advancedMetrics.speedMps.toFixed(2)} m/s.`;
    }

    summary += ` Calidad de análisis: ${qualityScore}%.`;

    // Key findings
    const keyFindings: string[] = [];

    // Significant patterns
    const significantPatterns = combinedPatterns.filter(p => p.status === 'likely');
    if (significantPatterns.length > 0) {
      keyFindings.push(`Patrones detectados: ${significantPatterns.map(p => p.label).join(', ')}`);
    }

    // Risk assessment
    if (riskAssessment.fallRisk > 50) {
      keyFindings.push(`Riesgo de caídas elevado: ${riskAssessment.fallRisk}%`);
    }

    // Advanced metrics highlights
    if (advancedMetrics.gaitSymmetryIndex && advancedMetrics.gaitSymmetryIndex > 15) {
      keyFindings.push(`Asimetría marcada detectada: ${advancedMetrics.gaitSymmetryIndex.toFixed(1)}%`);
    }

    if (advancedMetrics.stepTimeVariability && advancedMetrics.stepTimeVariability > 15) {
      keyFindings.push(`Alta variabilidad temporal: ${advancedMetrics.stepTimeVariability.toFixed(1)}%`);
    }

    // Recommendations
    const recommendations: string[] = [];

    if (riskAssessment.fallRisk > 70) {
      recommendations.push('Evaluación médica urgente recomendada');
      recommendations.push('Implementar medidas de prevención de caídas');
    } else if (riskAssessment.fallRisk > 40) {
      recommendations.push('Considerar fisioterapia y entrenamiento del equilibrio');
    }

    if (significantPatterns.length > 0) {
      recommendations.push('Análisis clínico detallado de los patrones detectados');
    }

    if (qualityScore < 70) {
      recommendations.push('Repetir análisis con mejor calidad de captura');
    }

    recommendations.push(riskAssessment.recommendation);

    // Technical notes
    const technicalNotes: string[] = [];
    technicalNotes.push(`Tiempo de procesamiento: ${result.processingTime.toFixed(0)}ms`);
    technicalNotes.push(`Confianza del análisis ML: ${(riskAssessment.confidence * 100).toFixed(0)}%`);

    if (result.advancedMetrics.harmonicRatio) {
      technicalNotes.push(`Índice de suavidad: ${result.advancedMetrics.harmonicRatio.toFixed(1)}`);
    }

    return {
      summary,
      keyFindings,
      recommendations,
      technicalNotes
    };
  }
}