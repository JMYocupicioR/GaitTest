import type { PoseFrame } from './poseEstimation.ts';

export interface FrontalMetrics {
  // Base of support
  stepWidth: number | null; // meters
  stepWidthVariability: number | null; // CV%

  // Trunk kinematics
  trunkLateralLean: number | null; // degrees
  trunkLateralLeanVariability: number | null; // CV%

  // Pelvic kinematics
  pelvicObliquity: number | null; // degrees
  pelvicDrop: number | null; // degrees during single limb support

  // Lower limb alignment
  kneeValgus: number | null; // degrees
  hipAdduction: number | null; // degrees

  // Compensatory patterns
  circumduction: boolean;
  hipHiking: boolean;
  excessiveTrunkSway: boolean;
  scissoring: boolean;

  // Stability measures
  lateralStabilityIndex: number | null; // 0-100
  mediolateralDisplacement: number | null; // meters

  // Asymmetry measures
  lateralAsymmetryIndex: number | null; // %
  compensationScore: number | null; // 0-100
}

export interface FrontalCompensation {
  type: 'trendelenburg' | 'circumduction' | 'hip_hiking' | 'trunk_lean' | 'scissoring' | 'knee_valgus';
  severity: 'mild' | 'moderate' | 'severe';
  affectedSide: 'left' | 'right' | 'bilateral';
  description: string;
  biomechanicalCause: string;
  clinicalImplication: string;
}

export class FrontalGaitAnalyzer {
  private frameBuffer: PoseFrame[] = [];
  private detectedCompensations: FrontalCompensation[] = [];

  // Clinical thresholds based on literature
  private static readonly THRESHOLDS = {
    stepWidth: {
      normal: { min: 0.08, max: 0.15 }, // meters
      wide: 0.20,
      narrow: 0.05
    },
    trunkLean: {
      normal: 2, // degrees
      moderate: 5,
      severe: 10
    },
    pelvicDrop: {
      normal: 2, // degrees
      moderate: 5,
      severe: 8
    },
    kneeValgus: {
      normal: 5, // degrees
      moderate: 10,
      severe: 15
    },
    variabilityThreshold: 15 // CV%
  };

  public processFrame(frame: PoseFrame): void {
    this.frameBuffer.push(frame);

    // Keep only last 100 frames for analysis
    if (this.frameBuffer.length > 100) {
      this.frameBuffer.shift();
    }
  }

  public calculateFrontalMetrics(): FrontalMetrics {
    if (this.frameBuffer.length < 20) {
      return this.getEmptyMetrics();
    }

    // Calculate step width
    const stepWidth = this.calculateStepWidth();
    const stepWidthVariability = this.calculateStepWidthVariability();

    // Calculate trunk kinematics
    const trunkLateralLean = this.calculateTrunkLateralLean();
    const trunkLateralLeanVariability = this.calculateTrunkLeanVariability();

    // Calculate pelvic kinematics
    const pelvicObliquity = this.calculatePelvicObliquity();
    const pelvicDrop = this.calculatePelvicDrop();

    // Calculate lower limb alignment
    const kneeValgus = this.calculateKneeValgus();
    const hipAdduction = this.calculateHipAdduction();

    // Detect compensatory patterns
    const compensations = this.detectCompensations();
    const circumduction = compensations.some(c => c.type === 'circumduction');
    const hipHiking = compensations.some(c => c.type === 'hip_hiking');
    const excessiveTrunkSway = compensations.some(c => c.type === 'trunk_lean');
    const scissoring = compensations.some(c => c.type === 'scissoring');

    // Calculate stability measures
    const lateralStabilityIndex = this.calculateLateralStabilityIndex();
    const mediolateralDisplacement = this.calculateMedialLateralDisplacement();

    // Calculate asymmetry measures
    const lateralAsymmetryIndex = this.calculateLateralAsymmetryIndex();
    const compensationScore = this.calculateCompensationScore(compensations);

    return {
      stepWidth,
      stepWidthVariability,
      trunkLateralLean,
      trunkLateralLeanVariability,
      pelvicObliquity,
      pelvicDrop,
      kneeValgus,
      hipAdduction,
      circumduction,
      hipHiking,
      excessiveTrunkSway,
      scissoring,
      lateralStabilityIndex,
      mediolateralDisplacement,
      lateralAsymmetryIndex,
      compensationScore
    };
  }

  private calculateStepWidth(): number | null {
    const stepWidths: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftAnkle.visibility > 0.7 && frame.rightAnkle.visibility > 0.7) {
        const width = Math.abs(frame.leftAnkle.x - frame.rightAnkle.x);
        // Convert normalized coordinates to approximate meters (assuming 640px ≈ 1.8m frame width)
        const widthMeters = width * 1.8;
        stepWidths.push(widthMeters);
      }
    }

    if (stepWidths.length === 0) return null;

    return stepWidths.reduce((sum, w) => sum + w, 0) / stepWidths.length;
  }

  private calculateStepWidthVariability(): number | null {
    const stepWidths: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftAnkle.visibility > 0.7 && frame.rightAnkle.visibility > 0.7) {
        const width = Math.abs(frame.leftAnkle.x - frame.rightAnkle.x) * 1.8;
        stepWidths.push(width);
      }
    }

    if (stepWidths.length < 10) return null;

    const mean = stepWidths.reduce((sum, w) => sum + w, 0) / stepWidths.length;
    const variance = stepWidths.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / stepWidths.length;
    const standardDeviation = Math.sqrt(variance);

    // Coefficient of variation
    return mean === 0 ? null : (standardDeviation / mean) * 100;
  }

  private calculateTrunkLateralLean(): number | null {
    const leanAngles: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        // Calculate trunk lean from vertical
        const hipMidpoint = {
          x: (frame.leftHip.x + frame.rightHip.x) / 2,
          y: (frame.leftHip.y + frame.rightHip.y) / 2
        };

        // Approximate shoulder position (not available in basic pose estimation)
        const shoulderEstimate = {
          x: hipMidpoint.x,
          y: hipMidpoint.y - 0.3 // Approximate trunk length
        };

        // Calculate lean angle from vertical
        const leanAngle = Math.atan2(
          Math.abs(shoulderEstimate.x - hipMidpoint.x),
          Math.abs(shoulderEstimate.y - hipMidpoint.y)
        ) * 180 / Math.PI;

        leanAngles.push(leanAngle);
      }
    }

    if (leanAngles.length === 0) return null;

    return leanAngles.reduce((sum, a) => sum + a, 0) / leanAngles.length;
  }

  private calculateTrunkLeanVariability(): number | null {
    const leanAngles: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        const hipMidpoint = {
          x: (frame.leftHip.x + frame.rightHip.x) / 2,
          y: (frame.leftHip.y + frame.rightHip.y) / 2
        };

        const leanAngle = Math.atan2(
          Math.abs(hipMidpoint.x - 0.5), // Deviation from center
          0.3 // Estimated trunk height
        ) * 180 / Math.PI;

        leanAngles.push(leanAngle);
      }
    }

    if (leanAngles.length < 10) return null;

    const mean = leanAngles.reduce((sum, a) => sum + a, 0) / leanAngles.length;
    const variance = leanAngles.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / leanAngles.length;
    const standardDeviation = Math.sqrt(variance);

    return mean === 0 ? null : (standardDeviation / mean) * 100;
  }

  private calculatePelvicObliquity(): number | null {
    const obliquityAngles: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        // Calculate angle of line connecting hips relative to horizontal
        const angle = Math.atan2(
          frame.rightHip.y - frame.leftHip.y,
          frame.rightHip.x - frame.leftHip.x
        ) * 180 / Math.PI;

        obliquityAngles.push(Math.abs(angle));
      }
    }

    if (obliquityAngles.length === 0) return null;

    return obliquityAngles.reduce((sum, a) => sum + a, 0) / obliquityAngles.length;
  }

  private calculatePelvicDrop(): number | null {
    // Pelvic drop during single limb support
    const dropAngles: number[] = [];

    for (let i = 1; i < this.frameBuffer.length; i++) {
      const prevFrame = this.frameBuffer[i - 1];
      const currFrame = this.frameBuffer[i];

      if (prevFrame.leftHip.visibility > 0.7 && prevFrame.rightHip.visibility > 0.7 &&
          currFrame.leftHip.visibility > 0.7 && currFrame.rightHip.visibility > 0.7) {

        const prevObliquity = Math.atan2(
          prevFrame.rightHip.y - prevFrame.leftHip.y,
          prevFrame.rightHip.x - prevFrame.leftHip.x
        ) * 180 / Math.PI;

        const currObliquity = Math.atan2(
          currFrame.rightHip.y - currFrame.leftHip.y,
          currFrame.rightHip.x - currFrame.leftHip.x
        ) * 180 / Math.PI;

        const dropChange = Math.abs(currObliquity - prevObliquity);
        dropAngles.push(dropChange);
      }
    }

    if (dropAngles.length === 0) return null;

    // Return maximum pelvic drop observed
    return Math.max(...dropAngles);
  }

  private calculateKneeValgus(): number | null {
    const valgusAngles: number[] = [];

    for (const frame of this.frameBuffer) {
      // Calculate knee valgus for both legs
      const leftValgus = this.calculateSingleKneeValgus(frame.leftHip, frame.leftKnee, frame.leftAnkle);
      const rightValgus = this.calculateSingleKneeValgus(frame.rightHip, frame.rightKnee, frame.rightAnkle);

      if (leftValgus !== null) valgusAngles.push(leftValgus);
      if (rightValgus !== null) valgusAngles.push(rightValgus);
    }

    if (valgusAngles.length === 0) return null;

    return valgusAngles.reduce((sum, a) => sum + a, 0) / valgusAngles.length;
  }

  private calculateSingleKneeValgus(hip: any, knee: any, ankle: any): number | null {
    if (!hip || !knee || !ankle ||
        hip.visibility < 0.7 || knee.visibility < 0.7 || ankle.visibility < 0.7) {
      return null;
    }

    // Calculate frontal plane knee angle
    const thighVector = { x: knee.x - hip.x, y: knee.y - hip.y };
    const shankVector = { x: ankle.x - knee.x, y: ankle.y - knee.y };

    // Calculate angle between thigh and shank in frontal plane
    const angle = Math.atan2(
      thighVector.x * shankVector.y - thighVector.y * shankVector.x,
      thighVector.x * shankVector.x + thighVector.y * shankVector.y
    ) * 180 / Math.PI;

    return Math.abs(angle);
  }

  private calculateHipAdduction(): number | null {
    const adductionAngles: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftHip.visibility > 0.7 && frame.leftKnee.visibility > 0.7 &&
          frame.rightHip.visibility > 0.7 && frame.rightKnee.visibility > 0.7) {

        // Calculate hip adduction angle (simplified)
        const leftAdduction = this.calculateSingleHipAdduction(frame.leftHip, frame.leftKnee);
        const rightAdduction = this.calculateSingleHipAdduction(frame.rightHip, frame.rightKnee);

        if (leftAdduction !== null) adductionAngles.push(leftAdduction);
        if (rightAdduction !== null) adductionAngles.push(rightAdduction);
      }
    }

    if (adductionAngles.length === 0) return null;

    return adductionAngles.reduce((sum, a) => sum + a, 0) / adductionAngles.length;
  }

  private calculateSingleHipAdduction(hip: any, knee: any): number | null {
    if (!hip || !knee || hip.visibility < 0.7 || knee.visibility < 0.7) {
      return null;
    }

    // Calculate deviation from vertical line through hip
    const adductionAngle = Math.atan2(
      Math.abs(knee.x - hip.x),
      Math.abs(knee.y - hip.y)
    ) * 180 / Math.PI;

    return adductionAngle;
  }

  private detectCompensations(): FrontalCompensation[] {
    const compensations: FrontalCompensation[] = [];

    // Analyze current metrics
    const stepWidth = this.calculateStepWidth();
    const trunkLean = this.calculateTrunkLateralLean();
    const pelvicDrop = this.calculatePelvicDrop();
    const kneeValgus = this.calculateKneeValgus();

    // Detect Trendelenburg gait
    if (pelvicDrop && pelvicDrop > FrontalGaitAnalyzer.THRESHOLDS.pelvicDrop.moderate) {
      compensations.push({
        type: 'trendelenburg',
        severity: pelvicDrop > FrontalGaitAnalyzer.THRESHOLDS.pelvicDrop.severe ? 'severe' : 'moderate',
        affectedSide: 'bilateral', // Would need more analysis to determine specific side
        description: `Caída pélvica de ${pelvicDrop.toFixed(1)}°`,
        biomechanicalCause: 'Debilidad de abductores de cadera',
        clinicalImplication: 'Riesgo de sobrecarga lumbar y inestabilidad lateral'
      });
    }

    // Detect excessive trunk lean
    if (trunkLean && trunkLean > FrontalGaitAnalyzer.THRESHOLDS.trunkLean.moderate) {
      compensations.push({
        type: 'trunk_lean',
        severity: trunkLean > FrontalGaitAnalyzer.THRESHOLDS.trunkLean.severe ? 'severe' : 'moderate',
        affectedSide: 'bilateral',
        description: `Inclinación lateral de tronco de ${trunkLean.toFixed(1)}°`,
        biomechanicalCause: 'Compensación por debilidad o acortamiento',
        clinicalImplication: 'Aumento del gasto energético y sobrecarga articular'
      });
    }

    // Detect wide base (scissoring inverse)
    if (stepWidth && stepWidth > FrontalGaitAnalyzer.THRESHOLDS.stepWidth.wide) {
      compensations.push({
        type: 'scissoring',
        severity: 'moderate',
        affectedSide: 'bilateral',
        description: `Base de apoyo amplia: ${stepWidth.toFixed(2)}m`,
        biomechanicalCause: 'Estrategia de estabilización',
        clinicalImplication: 'Reducción de eficiencia energética'
      });
    }

    // Detect knee valgus
    if (kneeValgus && kneeValgus > FrontalGaitAnalyzer.THRESHOLDS.kneeValgus.moderate) {
      compensations.push({
        type: 'knee_valgus',
        severity: kneeValgus > FrontalGaitAnalyzer.THRESHOLDS.kneeValgus.severe ? 'severe' : 'moderate',
        affectedSide: 'bilateral',
        description: `Valgo de rodilla de ${kneeValgus.toFixed(1)}°`,
        biomechanicalCause: 'Debilidad o desequilibrio muscular',
        clinicalImplication: 'Riesgo de lesión articular y dolor'
      });
    }

    this.detectedCompensations = compensations;
    return compensations;
  }

  private calculateLateralStabilityIndex(): number | null {
    if (this.frameBuffer.length < 20) return null;

    // Calculate lateral displacement variability
    const lateralPositions: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        const centerOfMass = (frame.leftHip.x + frame.rightHip.x) / 2;
        lateralPositions.push(centerOfMass);
      }
    }

    if (lateralPositions.length < 10) return null;

    const mean = lateralPositions.reduce((sum, pos) => sum + pos, 0) / lateralPositions.length;
    const variance = lateralPositions.reduce((sum, pos) => sum + Math.pow(pos - mean, 2), 0) / lateralPositions.length;
    const stability = Math.max(0, 100 - (Math.sqrt(variance) * 1000)); // Convert to 0-100 scale

    return Math.min(100, stability);
  }

  private calculateMedialLateralDisplacement(): number | null {
    if (this.frameBuffer.length < 20) return null;

    const lateralPositions: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        const centerOfMass = (frame.leftHip.x + frame.rightHip.x) / 2;
        lateralPositions.push(centerOfMass);
      }
    }

    if (lateralPositions.length < 2) return null;

    const maxDisplacement = Math.max(...lateralPositions) - Math.min(...lateralPositions);
    return maxDisplacement * 1.8; // Convert to meters
  }

  private calculateLateralAsymmetryIndex(): number | null {
    // Calculate asymmetry in lateral movement patterns
    const leftSideValues: number[] = [];
    const rightSideValues: number[] = [];

    for (const frame of this.frameBuffer) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        const center = (frame.leftHip.x + frame.rightHip.x) / 2;
        leftSideValues.push(Math.abs(frame.leftHip.x - center));
        rightSideValues.push(Math.abs(frame.rightHip.x - center));
      }
    }

    if (leftSideValues.length === 0 || rightSideValues.length === 0) return null;

    const leftMean = leftSideValues.reduce((sum, val) => sum + val, 0) / leftSideValues.length;
    const rightMean = rightSideValues.reduce((sum, val) => sum + val, 0) / rightSideValues.length;

    const asymmetry = Math.abs(leftMean - rightMean) / ((leftMean + rightMean) / 2) * 100;
    return asymmetry;
  }

  private calculateCompensationScore(compensations: FrontalCompensation[]): number | null {
    if (compensations.length === 0) return 100; // Perfect score

    let totalDeduction = 0;

    compensations.forEach(comp => {
      switch (comp.severity) {
        case 'mild':
          totalDeduction += 10;
          break;
        case 'moderate':
          totalDeduction += 20;
          break;
        case 'severe':
          totalDeduction += 35;
          break;
      }
    });

    return Math.max(0, 100 - totalDeduction);
  }

  private getEmptyMetrics(): FrontalMetrics {
    return {
      stepWidth: null,
      stepWidthVariability: null,
      trunkLateralLean: null,
      trunkLateralLeanVariability: null,
      pelvicObliquity: null,
      pelvicDrop: null,
      kneeValgus: null,
      hipAdduction: null,
      circumduction: false,
      hipHiking: false,
      excessiveTrunkSway: false,
      scissoring: false,
      lateralStabilityIndex: null,
      mediolateralDisplacement: null,
      lateralAsymmetryIndex: null,
      compensationScore: null
    };
  }

  public getDetectedCompensations(): FrontalCompensation[] {
    return [...this.detectedCompensations];
  }

  public clearBuffer(): void {
    this.frameBuffer = [];
    this.detectedCompensations = [];
  }

  public generateFrontalReport(metrics: FrontalMetrics, compensations: FrontalCompensation[]): string {
    let report = '## Análisis de Vista Frontal\n\n';

    // Base metrics
    report += '### Métricas Espaciales\n';
    if (metrics.stepWidth) {
      report += `- **Ancho de paso:** ${metrics.stepWidth.toFixed(3)} m\n`;
    }
    if (metrics.lateralStabilityIndex) {
      report += `- **Índice de estabilidad lateral:** ${metrics.lateralStabilityIndex.toFixed(1)}/100\n`;
    }
    if (metrics.mediolateralDisplacement) {
      report += `- **Desplazamiento mediolateral:** ${metrics.mediolateralDisplacement.toFixed(3)} m\n`;
    }

    // Kinematic analysis
    report += '\n### Análisis Cinemático\n';
    if (metrics.pelvicObliquity) {
      report += `- **Oblicuidad pélvica:** ${metrics.pelvicObliquity.toFixed(1)}°\n`;
    }
    if (metrics.trunkLateralLean) {
      report += `- **Inclinación lateral de tronco:** ${metrics.trunkLateralLean.toFixed(1)}°\n`;
    }
    if (metrics.kneeValgus) {
      report += `- **Valgo de rodilla:** ${metrics.kneeValgus.toFixed(1)}°\n`;
    }

    // Compensations
    if (compensations.length > 0) {
      report += '\n### Compensaciones Detectadas\n';
      compensations.forEach(comp => {
        report += `- **${comp.type.toUpperCase()}** (${comp.severity})\n`;
        report += `  ${comp.description}\n`;
        report += `  *Causa: ${comp.biomechanicalCause}*\n`;
        report += `  *Implicación: ${comp.clinicalImplication}*\n\n`;
      });
    }

    // Overall assessment
    if (metrics.compensationScore) {
      report += `\n### Evaluación Global\n`;
      report += `**Puntuación de compensación:** ${metrics.compensationScore.toFixed(1)}/100\n`;

      if (metrics.compensationScore >= 80) {
        report += `*Excelente - Patrones de movimiento eficientes*\n`;
      } else if (metrics.compensationScore >= 60) {
        report += `*Bueno - Compensaciones leves*\n`;
      } else if (metrics.compensationScore >= 40) {
        report += `*Regular - Compensaciones moderadas que requieren atención*\n`;
      } else {
        report += `*Deficiente - Compensaciones severas que requieren intervención*\n`;
      }
    }

    return report;
  }
}