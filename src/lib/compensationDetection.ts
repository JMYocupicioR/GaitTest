import type { PoseFrame } from './poseEstimation.ts';
import type { ViewMode } from '../types/session.ts';
import type { KinematicSummary } from '../types/session.ts';
import type { FrontalMetrics } from './frontalAnalysis.ts';

export interface CompensationPattern {
  id: CompensationPatternType;
  type: CompensationPatternType;
  side: 'left' | 'right' | 'bilateral';
  severity: 'mild' | 'moderate' | 'severe';
  confidence: number; // 0-1
  description: string;
  biomechanicalCause: string[];
  clinicalImplication: string;
  recommendedIntervention: string[];
  phase: 'stance' | 'swing' | 'both';
  detectionMethod: 'kinematic' | 'temporal' | 'spatial' | 'combined';
}

export type CompensationPatternType =
  | 'circumduction'
  | 'hip_hiking'
  | 'trendelenburg'
  | 'steppage'
  | 'crouch_gait'
  | 'stiff_knee'
  | 'excessive_knee_flexion'
  | 'foot_drop'
  | 'antalgic'
  | 'trunk_lean'
  | 'scissoring'
  | 'wide_base'
  | 'toe_walking'
  | 'heel_walking'
  | 'vaulting'
  | 'lateral_trunk_bending';

export interface CompensationAnalysis {
  detectedCompensations: CompensationPattern[];
  compensationScore: number; // 0-100 (100 = no compensations)
  primaryCompensation: CompensationPattern | null;
  secondaryCompensations: CompensationPattern[];
  overallSeverity: 'none' | 'mild' | 'moderate' | 'severe';
  functionalImpact: FunctionalImpact;
}

export interface FunctionalImpact {
  energyExpenditureIncrease: number; // % increase
  mobilityReduction: number; // % reduction
  fallRiskIncrease: number; // % increase
  painPrediction: 'low' | 'moderate' | 'high';
  functionalLevel: 'independent' | 'assisted' | 'dependent';
}

export class CompensationDetector {
  private frameHistory: PoseFrame[] = [];
  private viewMode: ViewMode;

  // Detection thresholds based on clinical literature
  private static readonly THRESHOLDS = {
    circumduction: {
      lateralDeviation: 0.05, // meters
      temporalMarker: 15 // % increase in swing time
    },
    hipHiking: {
      pelvicObliquity: 8, // degrees
      hipElevation: 0.03 // meters
    },
    trendelenburg: {
      pelvicDrop: 5, // degrees
      lateralLean: 8 // degrees
    },
    steppage: {
      excessiveHipFlexion: 45, // degrees
      excessiveKneeFlexion: 70, // degrees
      footClearance: 0.02 // meters
    },
    crouchGait: {
      kneeFlexion: 25, // degrees at initial contact
      hipFlexion: 20, // degrees at initial contact
      ankleDF: 15 // degrees excessive dorsiflexion
    },
    stiffKnee: {
      reducedFlexion: 35, // degrees (normal ~60)
      circumductionCompensation: true
    },
    antalgic: {
      stanceTimeReduction: 20, // % reduction
      stepLengthReduction: 15 // % reduction
    },
    footDrop: {
      toeFirst: true,
      excessiveHipFlexion: 40 // degrees
    }
  };

  constructor(viewMode: ViewMode = 'lateral') {
    this.viewMode = viewMode;
  }

  public processFrame(frame: PoseFrame): void {
    this.frameHistory.push(frame);

    // Keep reasonable history (200 frames ~3-4 seconds)
    if (this.frameHistory.length > 200) {
      this.frameHistory.shift();
    }
  }

  public detectCompensations(
    kinematics?: KinematicSummary,
    frontalMetrics?: FrontalMetrics
  ): CompensationAnalysis {
    const detectedCompensations: CompensationPattern[] = [];

    // Detect compensations based on available data
    if (this.viewMode === 'lateral' || this.viewMode === 'dual') {
      detectedCompensations.push(...this.detectSagittalCompensations(kinematics));
    }

    if (this.viewMode === 'frontal' || this.viewMode === 'dual') {
      detectedCompensations.push(...this.detectFrontalCompensations(frontalMetrics));
    }

    // Detect temporal and spatial compensations
    detectedCompensations.push(...this.detectTemporalCompensations());
    detectedCompensations.push(...this.detectSpatialCompensations());

    // Analyze detected compensations
    const compensationScore = this.calculateCompensationScore(detectedCompensations);
    const { primary, secondary } = this.categorizeCompensations(detectedCompensations);
    const overallSeverity = this.determineOverallSeverity(detectedCompensations);
    const functionalImpact = this.assessFunctionalImpact(detectedCompensations);

    return {
      detectedCompensations,
      compensationScore,
      primaryCompensation: primary,
      secondaryCompensations: secondary,
      overallSeverity,
      functionalImpact
    };
  }

  private detectSagittalCompensations(kinematics?: KinematicSummary): CompensationPattern[] {
    const compensations: CompensationPattern[] = [];

    if (!kinematics) return compensations;

    // Detect crouch gait
    const leftKneeFlexion = kinematics.peakValues?.maxKneeFlex?.left || 0;

    if (leftKneeFlexion > CompensationDetector.THRESHOLDS.crouchGait.kneeFlexion) {
      compensations.push({
        id: 'crouch_gait',
        type: 'crouch_gait',
        side: 'left',
        severity: leftKneeFlexion > 35 ? 'severe' : 'moderate',
        confidence: 0.8,
        description: `Marcha en flexión con flexión excesiva de rodilla (${leftKneeFlexion.toFixed(1)}°)`,
        biomechanicalCause: [
          'Contracturas de flexores de cadera',
          'Debilidad de extensores de rodilla',
          'Espasticidad de flexores'
        ],
        clinicalImplication: 'Aumento significativo del gasto energético y sobrecarga articular',
        recommendedIntervention: [
          'Estiramientos de flexores de cadera',
          'Fortalecimiento de cuádriceps',
          'Órtesis de extensión'
        ],
        phase: 'stance',
        detectionMethod: 'kinematic'
      });
    }

    // Detect stiff knee gait
    if (leftKneeFlexion < CompensationDetector.THRESHOLDS.stiffKnee.reducedFlexion) {
      compensations.push({
        id: 'stiff_knee',
        type: 'stiff_knee',
        side: 'left',
        severity: leftKneeFlexion < 25 ? 'severe' : 'moderate',
        confidence: 0.85,
        description: `Rodilla rígida con flexión reducida (${leftKneeFlexion.toFixed(1)}°)`,
        biomechanicalCause: [
          'Espasticidad de cuádriceps',
          'Contractura de cuádriceps',
          'Debilidad de flexores de rodilla'
        ],
        clinicalImplication: 'Dificultad para el despegue del pie y compensaciones proximales',
        recommendedIntervention: [
          'Estiramientos de cuádriceps',
          'Fortalecimiento de isquiotibiales',
          'Tratamiento de espasticidad'
        ],
        phase: 'swing',
        detectionMethod: 'kinematic'
      });
    }

    // Detect steppage gait (foot drop)
    const leftHipFlexion = kinematics.peakValues?.maxHipFlex?.left || 0;
    if (leftHipFlexion > CompensationDetector.THRESHOLDS.steppage.excessiveHipFlexion) {
      compensations.push({
        id: 'steppage',
        type: 'steppage',
        side: 'left',
        severity: leftHipFlexion > 50 ? 'severe' : 'moderate',
        confidence: 0.75,
        description: `Marcha en estepaje con flexión excesiva de cadera (${leftHipFlexion.toFixed(1)}°)`,
        biomechanicalCause: [
          'Debilidad de dorsiflexores',
          'Parálisis del nervio peroneo',
          'Foot drop'
        ],
        clinicalImplication: 'Riesgo aumentado de tropiezos y caídas',
        recommendedIntervention: [
          'Órtesis de pie y tobillo (AFO)',
          'Fortalecimiento de dorsiflexores',
          'Entrenamiento de la marcha'
        ],
        phase: 'swing',
        detectionMethod: 'kinematic'
      });
    }

    // Add similar detections for right side...
    // (Similar logic for right side compensations)

    return compensations;
  }

  private detectFrontalCompensations(frontalMetrics?: FrontalMetrics): CompensationPattern[] {
    const compensations: CompensationPattern[] = [];

    if (!frontalMetrics) return compensations;

    // Detect Trendelenburg gait
    if (frontalMetrics.pelvicDrop && frontalMetrics.pelvicDrop > CompensationDetector.THRESHOLDS.trendelenburg.pelvicDrop) {
      compensations.push({
        id: 'trendelenburg',
        type: 'trendelenburg',
        side: 'bilateral',
        severity: frontalMetrics.pelvicDrop > 8 ? 'severe' : 'moderate',
        confidence: 0.9,
        description: `Marcha trendelenburg con caída pélvica (${frontalMetrics.pelvicDrop.toFixed(1)}°)`,
        biomechanicalCause: [
          'Debilidad de abductores de cadera',
          'Luxación de cadera',
          'Dolor en cadera'
        ],
        clinicalImplication: 'Inestabilidad lateral y sobrecarga de columna lumbar',
        recommendedIntervention: [
          'Fortalecimiento de glúteo medio',
          'Ejercicios de estabilización pélvica',
          'Evaluación radiológica de cadera'
        ],
        phase: 'stance',
        detectionMethod: 'kinematic'
      });
    }

    // Detect circumduction
    if (frontalMetrics.circumduction) {
      compensations.push({
        id: 'circumduction',
        type: 'circumduction',
        side: 'bilateral', // Would need more analysis to determine specific side
        severity: 'moderate',
        confidence: 0.7,
        description: 'Circunducción detectada durante la fase de balanceo',
        biomechanicalCause: [
          'Rodilla rígida',
          'Extremidad funcionalmente larga',
          'Debilidad de flexores de cadera'
        ],
        clinicalImplication: 'Compensación para el despegue del pie, aumento del gasto energético',
        recommendedIntervention: [
          'Mejora de flexión de rodilla',
          'Fortalecimiento de flexores de cadera',
          'Análisis de longitud de extremidades'
        ],
        phase: 'swing',
        detectionMethod: 'spatial'
      });
    }

    // Detect hip hiking
    if (frontalMetrics.hipHiking) {
      compensations.push({
        id: 'hip_hiking',
        type: 'hip_hiking',
        side: 'bilateral',
        severity: 'moderate',
        confidence: 0.75,
        description: 'Elevación de cadera para despegue del pie',
        biomechanicalCause: [
          'Extremidad funcionalmente larga',
          'Debilidad de flexores de cadera',
          'Rigidez articular'
        ],
        clinicalImplication: 'Compensación energéticamente costosa, posible dolor lumbar',
        recommendedIntervention: [
          'Evaluación de longitud de extremidades',
          'Mejora de movilidad articular',
          'Fortalecimiento selectivo'
        ],
        phase: 'swing',
        detectionMethod: 'kinematic'
      });
    }

    // Detect wide base gait
    if (frontalMetrics.stepWidth && frontalMetrics.stepWidth > 0.20) {
      compensations.push({
        id: 'wide_base',
        type: 'wide_base',
        side: 'bilateral',
        severity: frontalMetrics.stepWidth > 0.25 ? 'severe' : 'moderate',
        confidence: 0.85,
        description: `Base de apoyo amplia (${frontalMetrics.stepWidth.toFixed(2)} m)`,
        biomechanicalCause: [
          'Inestabilidad del equilibrio',
          'Debilidad muscular',
          'Déficit propioceptivo'
        ],
        clinicalImplication: 'Estrategia compensatoria para mejorar estabilidad, reducción de eficiencia',
        recommendedIntervention: [
          'Entrenamiento del equilibrio',
          'Fortalecimiento del core',
          'Ejercicios propioceptivos'
        ],
        phase: 'both',
        detectionMethod: 'spatial'
      });
    }

    return compensations;
  }

  private detectTemporalCompensations(): CompensationPattern[] {
    const compensations: CompensationPattern[] = [];

    if (this.frameHistory.length < 50) return compensations;

    // Analyze step timing patterns
    const stepTimings = this.analyzeStepTimings();

    // Detect antalgic gait (reduced stance time)
    if (stepTimings.asymmetry > CompensationDetector.THRESHOLDS.antalgic.stanceTimeReduction) {
      compensations.push({
        id: 'antalgic',
        type: 'antalgic',
        side: stepTimings.affectedSide,
        severity: stepTimings.asymmetry > 30 ? 'severe' : 'moderate',
        confidence: 0.8,
        description: `Marcha antálgica con asimetría temporal (${stepTimings.asymmetry.toFixed(1)}%)`,
        biomechanicalCause: [
          'Dolor durante la carga',
          'Debilidad muscular',
          'Inestabilidad articular'
        ],
        clinicalImplication: 'Protección de extremidad dolorosa, sobrecarga contralateral',
        recommendedIntervention: [
          'Manejo del dolor',
          'Mejora de la función muscular',
          'Ayudas técnicas temporales'
        ],
        phase: 'stance',
        detectionMethod: 'temporal'
      });
    }

    return compensations;
  }

  private detectSpatialCompensations(): CompensationPattern[] {
    const compensations: CompensationPattern[] = [];

    if (this.frameHistory.length < 30) return compensations;

    // Analyze spatial patterns
    const spatialPatterns = this.analyzeSpatialPatterns();

    // Detect lateral trunk bending
    if (spatialPatterns.trunkLateralDeviation > 0.05) {
      compensations.push({
        id: 'lateral_trunk_bending',
        type: 'lateral_trunk_bending',
        side: 'bilateral',
        severity: spatialPatterns.trunkLateralDeviation > 0.08 ? 'severe' : 'moderate',
        confidence: 0.7,
        description: `Inclinación lateral excesiva del tronco (${(spatialPatterns.trunkLateralDeviation * 100).toFixed(1)} cm)`,
        biomechanicalCause: [
          'Debilidad de abductores de cadera',
          'Discrepancia de longitud de extremidades',
          'Compensación por dolor'
        ],
        clinicalImplication: 'Sobrecarga asimétrica de columna vertebral',
        recommendedIntervention: [
          'Fortalecimiento de musculatura estabilizadora',
          'Corrección postural',
          'Evaluación biomecánica detallada'
        ],
        phase: 'stance',
        detectionMethod: 'spatial'
      });
    }

    return compensations;
  }

  private analyzeStepTimings(): { asymmetry: number; affectedSide: 'left' | 'right' } {
    // Simplified analysis - would need proper event detection
    // This is a simplified implementation
    // In reality, you'd use proper gait event detection

    let leftSum = 0;
    let rightSum = 0;
    let leftCount = 0;
    let rightCount = 0;

    // Simplified timing analysis based on ankle positions
    for (let i = 1; i < this.frameHistory.length; i++) {
      const frame = this.frameHistory[i];
      const prevFrame = this.frameHistory[i - 1];

      // Detect potential stance phases (simplified)
      if (frame.leftAnkle.y > frame.leftKnee.y && prevFrame.leftAnkle.y <= prevFrame.leftKnee.y) {
        leftSum += frame.timestamp - prevFrame.timestamp;
        leftCount++;
      }

      if (frame.rightAnkle.y > frame.rightKnee.y && prevFrame.rightAnkle.y <= prevFrame.rightKnee.y) {
        rightSum += frame.timestamp - prevFrame.timestamp;
        rightCount++;
      }
    }

    const leftAvg = leftCount > 0 ? leftSum / leftCount : 0;
    const rightAvg = rightCount > 0 ? rightSum / rightCount : 0;

    if (leftAvg === 0 || rightAvg === 0) {
      return { asymmetry: 0, affectedSide: 'left' };
    }

    const asymmetry = Math.abs(leftAvg - rightAvg) / ((leftAvg + rightAvg) / 2) * 100;
    const affectedSide = leftAvg < rightAvg ? 'left' : 'right';

    return { asymmetry, affectedSide };
  }

  private analyzeSpatialPatterns(): { trunkLateralDeviation: number } {
    const lateralDeviations: number[] = [];

    for (const frame of this.frameHistory) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        const hipCenter = (frame.leftHip.x + frame.rightHip.x) / 2;
        const deviation = Math.abs(hipCenter - 0.5); // Deviation from center
        lateralDeviations.push(deviation);
      }
    }

    const avgDeviation = lateralDeviations.length > 0 ?
      lateralDeviations.reduce((sum, dev) => sum + dev, 0) / lateralDeviations.length : 0;

    return {
      trunkLateralDeviation: avgDeviation * 1.8 // Convert to meters
    };
  }

  private calculateCompensationScore(compensations: CompensationPattern[]): number {
    let score = 100;

    compensations.forEach(comp => {
      const severityPenalty = {
        mild: 5,
        moderate: 15,
        severe: 25
      };

      const confidenceFactor = comp.confidence;
      const penalty = severityPenalty[comp.severity] * confidenceFactor;

      score -= penalty;
    });

    return Math.max(0, score);
  }

  private categorizeCompensations(compensations: CompensationPattern[]): {
    primary: CompensationPattern | null;
    secondary: CompensationPattern[];
  } {
    if (compensations.length === 0) {
      return { primary: null, secondary: [] };
    }

    // Sort by severity and confidence
    const sorted = [...compensations].sort((a, b) => {
      const severityWeight = { mild: 1, moderate: 2, severe: 3 };
      const scoreA = severityWeight[a.severity] * a.confidence;
      const scoreB = severityWeight[b.severity] * b.confidence;
      return scoreB - scoreA;
    });

    return {
      primary: sorted[0],
      secondary: sorted.slice(1)
    };
  }

  private determineOverallSeverity(compensations: CompensationPattern[]): 'none' | 'mild' | 'moderate' | 'severe' {
    if (compensations.length === 0) return 'none';

    const severeCount = compensations.filter(c => c.severity === 'severe').length;
    const moderateCount = compensations.filter(c => c.severity === 'moderate').length;

    if (severeCount > 0) return 'severe';
    if (moderateCount > 1) return 'severe';
    if (moderateCount > 0) return 'moderate';
    return 'mild';
  }

  private assessFunctionalImpact(compensations: CompensationPattern[]): FunctionalImpact {
    let energyIncrease = 0;
    let mobilityReduction = 0;
    let fallRiskIncrease = 0;

    compensations.forEach(comp => {
      // Energy expenditure impact
      const energyImpact: Partial<Record<CompensationPatternType, number>> = {
        circumduction: 15,
        hip_hiking: 20,
        crouch_gait: 35,
        steppage: 25,
        trendelenburg: 30,
        wide_base: 20
      };

      // Mobility impact
      const mobilityImpact: Partial<Record<CompensationPatternType, number>> = {
        stiff_knee: 25,
        crouch_gait: 30,
        antalgic: 20,
        steppage: 15
      };

      // Fall risk impact
      const fallRiskImpact: Partial<Record<CompensationPatternType, number>> = {
        steppage: 40,
        foot_drop: 45,
        wide_base: 15,
        trendelenburg: 25,
        antalgic: 20
      };

      energyIncrease += (energyImpact[comp.type] ?? 0) * comp.confidence;
      mobilityReduction += (mobilityImpact[comp.type] ?? 0) * comp.confidence;
      fallRiskIncrease += (fallRiskImpact[comp.type] ?? 0) * comp.confidence;
    });

    // Determine pain prediction
    const painPrediction = compensations.some(c =>
      ['antalgic', 'trendelenburg', 'lateral_trunk_bending'].includes(c.type)
    ) ? 'high' : compensations.length > 2 ? 'moderate' : 'low';

    // Determine functional level
    let functionalLevel: 'independent' | 'assisted' | 'dependent' = 'independent';
    if (mobilityReduction > 50 || fallRiskIncrease > 40) {
      functionalLevel = 'dependent';
    } else if (mobilityReduction > 25 || fallRiskIncrease > 25) {
      functionalLevel = 'assisted';
    }

    return {
      energyExpenditureIncrease: Math.min(100, energyIncrease),
      mobilityReduction: Math.min(100, mobilityReduction),
      fallRiskIncrease: Math.min(100, fallRiskIncrease),
      painPrediction,
      functionalLevel
    };
  }

  public generateCompensationReport(analysis: CompensationAnalysis): string {
    let report = '## Análisis de Compensaciones\n\n';

    // Overall assessment
    report += `**Puntuación de Compensación:** ${analysis.compensationScore}/100\n`;
    report += `**Severidad Global:** ${analysis.overallSeverity}\n\n`;

    // Primary compensation
    if (analysis.primaryCompensation) {
      report += '### Compensación Principal\n';
      const comp = analysis.primaryCompensation;
      report += `**${comp.type.toUpperCase()}** (${comp.side} - ${comp.severity})\n`;
      report += `${comp.description}\n\n`;
      report += `**Causas biomecánicas:**\n`;
      comp.biomechanicalCause.forEach(cause => report += `- ${cause}\n`);
      report += `\n**Implicación clínica:** ${comp.clinicalImplication}\n\n`;
      report += `**Intervenciones recomendadas:**\n`;
      comp.recommendedIntervention.forEach(intervention => report += `- ${intervention}\n`);
      report += '\n';
    }

    // Secondary compensations
    if (analysis.secondaryCompensations.length > 0) {
      report += '### Compensaciones Secundarias\n';
      analysis.secondaryCompensations.forEach(comp => {
        report += `- **${comp.type}** (${comp.severity}): ${comp.description}\n`;
      });
      report += '\n';
    }

    // Functional impact
    report += '### Impacto Funcional\n';
    report += `- **Aumento del gasto energético:** ${analysis.functionalImpact.energyExpenditureIncrease.toFixed(0)}%\n`;
    report += `- **Reducción de movilidad:** ${analysis.functionalImpact.mobilityReduction.toFixed(0)}%\n`;
    report += `- **Aumento del riesgo de caídas:** ${analysis.functionalImpact.fallRiskIncrease.toFixed(0)}%\n`;
    report += `- **Predicción de dolor:** ${analysis.functionalImpact.painPrediction}\n`;
    report += `- **Nivel funcional:** ${analysis.functionalImpact.functionalLevel}\n\n`;

    return report;
  }

  public clearHistory(): void {
    this.frameHistory = [];
  }
}