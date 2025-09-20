import type { AdvancedMetrics } from '../types/session.ts';
import type { GaitCycle, DetectedGaitEvent } from './advancedEventDetection.ts';

export interface GaitCycleMetrics {
  // Temporal parameters
  strideTime: number;
  stepTime: number;
  cadence: number;

  // Stance phase metrics (% of cycle)
  stancePhasePercent: number;
  swingPhasePercent: number;
  doubleSupport: number;
  singleSupport: number;

  // Phase durations (% of cycle)
  initialContactPercent: number;
  loadingResponsePercent: number;
  midStancePercent: number;
  terminalStancePercent: number;
  preSwingPercent: number;
  initialSwingPercent: number;
  midSwingPercent: number;
  terminalSwingPercent: number;

  // Asymmetry indices
  stepTimeAsymmetry: number;
  stanceTimeAsymmetry: number;
  swingTimeAsymmetry: number;

  // Clinical indicators
  clinicalDeviations: ClinicalDeviation[];
  functionalScore: number;
  gaitEfficiency: number;
}

export interface ClinicalDeviation {
  phase: string;
  deviation: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  clinicalSignificance: string;
}

export interface GaitCycleComparison {
  leftCycle: GaitCycleMetrics;
  rightCycle: GaitCycleMetrics;
  asymmetryAnalysis: AsymmetryAnalysis;
  bilateralDeviations: ClinicalDeviation[];
}

export interface AsymmetryAnalysis {
  stepTimeAsymmetry: number;
  stanceTimeAsymmetry: number;
  swingTimeAsymmetry: number;
  spatialAsymmetry: number;
  temporalAsymmetry: number;
  overallAsymmetryIndex: number;
  clinicalInterpretation: string;
}

export class GaitCycleAnalyzer {
  // Clinical reference values (based on literature)
  private static readonly NORMAL_RANGES = {
    stancePhase: { min: 58, max: 62 }, // % of cycle
    swingPhase: { min: 38, max: 42 }, // % of cycle
    initialContact: { min: 0, max: 2 }, // % of cycle
    loadingResponse: { min: 0, max: 12 }, // % of cycle
    midStance: { min: 12, max: 31 }, // % of cycle
    terminalStance: { min: 31, max: 50 }, // % of cycle
    preSwing: { min: 50, max: 62 }, // % of cycle
    initialSwing: { min: 62, max: 75 }, // % of cycle
    midSwing: { min: 75, max: 87 }, // % of cycle
    terminalSwing: { min: 87, max: 100 }, // % of cycle
    cadence: { min: 90, max: 130 }, // steps/min
    strideTime: { min: 0.9, max: 1.3 }, // seconds
    asymmetryThreshold: 5 // % difference considered abnormal
  };

  public analyzeGaitCycles(cycles: GaitCycle[]): GaitCycleComparison | null {
    if (cycles.length < 2) return null;

    const leftCycles = cycles.filter(c => c.foot === 'L');
    const rightCycles = cycles.filter(c => c.foot === 'R');

    if (leftCycles.length === 0 || rightCycles.length === 0) return null;

    const leftMetrics = this.calculateCycleMetrics(leftCycles);
    const rightMetrics = this.calculateCycleMetrics(rightCycles);

    const asymmetryAnalysis = this.analyzeAsymmetry(leftMetrics, rightMetrics);
    const bilateralDeviations = this.identifyBilateralDeviations(leftMetrics, rightMetrics);

    return {
      leftCycle: leftMetrics,
      rightCycle: rightMetrics,
      asymmetryAnalysis,
      bilateralDeviations
    };
  }

  private calculateCycleMetrics(cycles: GaitCycle[]): GaitCycleMetrics {
    const avgCycle = this.calculateAverageCycle(cycles);

    // Calculate temporal parameters
    const strideTime = avgCycle.duration;
    const stepTime = strideTime / 2; // Approximation
    const cadence = 60 / stepTime;

    // Calculate phase percentages
    const stancePhasePercent = (
      avgCycle.phases.initialContact.percentOfCycle +
      avgCycle.phases.loadingResponse.percentOfCycle +
      avgCycle.phases.midStance.percentOfCycle +
      avgCycle.phases.terminalStance.percentOfCycle +
      avgCycle.phases.preSwing.percentOfCycle
    );

    const swingPhasePercent = (
      avgCycle.phases.initialSwing.percentOfCycle +
      avgCycle.phases.midSwing.percentOfCycle +
      avgCycle.phases.terminalSwing.percentOfCycle
    );

    // Estimate double support (approximation)
    const doubleSupport = avgCycle.phases.loadingResponse.percentOfCycle + avgCycle.phases.preSwing.percentOfCycle;
    const singleSupport = stancePhasePercent - doubleSupport;

    // Calculate asymmetry indices (will be calculated later in comparison)
    const stepTimeAsymmetry = 0;
    const stanceTimeAsymmetry = 0;
    const swingTimeAsymmetry = 0;

    // Identify clinical deviations
    const clinicalDeviations = this.identifyDeviations(avgCycle);

    // Calculate functional scores
    const functionalScore = this.calculateFunctionalScore(avgCycle, clinicalDeviations);
    const gaitEfficiency = this.calculateGaitEfficiency(avgCycle);

    return {
      strideTime,
      stepTime,
      cadence,
      stancePhasePercent,
      swingPhasePercent,
      doubleSupport,
      singleSupport,
      initialContactPercent: avgCycle.phases.initialContact.percentOfCycle,
      loadingResponsePercent: avgCycle.phases.loadingResponse.percentOfCycle,
      midStancePercent: avgCycle.phases.midStance.percentOfCycle,
      terminalStancePercent: avgCycle.phases.terminalStance.percentOfCycle,
      preSwingPercent: avgCycle.phases.preSwing.percentOfCycle,
      initialSwingPercent: avgCycle.phases.initialSwing.percentOfCycle,
      midSwingPercent: avgCycle.phases.midSwing.percentOfCycle,
      terminalSwingPercent: avgCycle.phases.terminalSwing.percentOfCycle,
      stepTimeAsymmetry,
      stanceTimeAsymmetry,
      swingTimeAsymmetry,
      clinicalDeviations,
      functionalScore,
      gaitEfficiency
    };
  }

  private calculateAverageCycle(cycles: GaitCycle[]): GaitCycle {
    if (cycles.length === 0) {
      throw new Error('No cycles provided for averaging');
    }

    if (cycles.length === 1) {
      return cycles[0];
    }

    // Calculate average durations and percentages
    const avgDuration = cycles.reduce((sum, c) => sum + c.duration, 0) / cycles.length;

    // Average phase percentages
    const avgPhases = {
      initialContact: {
        name: 'Initial Contact',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.initialContact.percentOfCycle, 0) / cycles.length
      },
      loadingResponse: {
        name: 'Loading Response',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.loadingResponse.percentOfCycle, 0) / cycles.length
      },
      midStance: {
        name: 'Mid Stance',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.midStance.percentOfCycle, 0) / cycles.length
      },
      terminalStance: {
        name: 'Terminal Stance',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.terminalStance.percentOfCycle, 0) / cycles.length
      },
      preSwing: {
        name: 'Pre Swing',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.preSwing.percentOfCycle, 0) / cycles.length
      },
      initialSwing: {
        name: 'Initial Swing',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.initialSwing.percentOfCycle, 0) / cycles.length
      },
      midSwing: {
        name: 'Mid Swing',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.midSwing.percentOfCycle, 0) / cycles.length
      },
      terminalSwing: {
        name: 'Terminal Swing',
        startTime: 0,
        endTime: 0,
        duration: 0,
        percentOfCycle: cycles.reduce((sum, c) => sum + c.phases.terminalSwing.percentOfCycle, 0) / cycles.length
      }
    };

    return {
      foot: cycles[0].foot,
      startTime: 0,
      endTime: avgDuration,
      duration: avgDuration,
      phases: avgPhases,
      events: []
    };
  }

  private identifyDeviations(cycle: GaitCycle): ClinicalDeviation[] {
    const deviations: ClinicalDeviation[] = [];

    // Check stance phase duration
    const stancePhase = cycle.phases.initialContact.percentOfCycle +
                       cycle.phases.loadingResponse.percentOfCycle +
                       cycle.phases.midStance.percentOfCycle +
                       cycle.phases.terminalStance.percentOfCycle +
                       cycle.phases.preSwing.percentOfCycle;

    if (stancePhase < GaitCycleAnalyzer.NORMAL_RANGES.stancePhase.min) {
      deviations.push({
        phase: 'Stance Phase',
        deviation: 'Reduced stance time',
        severity: stancePhase < 50 ? 'severe' : 'moderate',
        description: `Stance phase ${stancePhase.toFixed(1)}% (normal: 58-62%)`,
        clinicalSignificance: 'May indicate weakness, pain, or balance issues'
      });
    } else if (stancePhase > GaitCycleAnalyzer.NORMAL_RANGES.stancePhase.max) {
      deviations.push({
        phase: 'Stance Phase',
        deviation: 'Prolonged stance time',
        severity: stancePhase > 70 ? 'severe' : 'moderate',
        description: `Stance phase ${stancePhase.toFixed(1)}% (normal: 58-62%)`,
        clinicalSignificance: 'May indicate instability, weakness, or compensatory pattern'
      });
    }

    // Check loading response
    if (cycle.phases.loadingResponse.percentOfCycle > 15) {
      deviations.push({
        phase: 'Loading Response',
        deviation: 'Prolonged loading response',
        severity: cycle.phases.loadingResponse.percentOfCycle > 20 ? 'severe' : 'moderate',
        description: `Loading response ${cycle.phases.loadingResponse.percentOfCycle.toFixed(1)}% (normal: 0-12%)`,
        clinicalSignificance: 'May indicate quadriceps weakness or knee instability'
      });
    }

    // Check swing phase
    const swingPhase = cycle.phases.initialSwing.percentOfCycle +
                      cycle.phases.midSwing.percentOfCycle +
                      cycle.phases.terminalSwing.percentOfCycle;

    if (swingPhase < GaitCycleAnalyzer.NORMAL_RANGES.swingPhase.min) {
      deviations.push({
        phase: 'Swing Phase',
        deviation: 'Reduced swing time',
        severity: swingPhase < 30 ? 'severe' : 'moderate',
        description: `Swing phase ${swingPhase.toFixed(1)}% (normal: 38-42%)`,
        clinicalSignificance: 'May indicate hip flexor weakness or spasticity'
      });
    }

    // Check for abnormal phase durations
    if (cycle.phases.midStance.percentOfCycle < 15) {
      deviations.push({
        phase: 'Mid Stance',
        deviation: 'Shortened mid stance',
        severity: 'moderate',
        description: `Mid stance ${cycle.phases.midStance.percentOfCycle.toFixed(1)}% (normal: 12-31%)`,
        clinicalSignificance: 'May indicate antalgic gait or weight-bearing difficulty'
      });
    }

    return deviations;
  }

  private calculateFunctionalScore(cycle: GaitCycle, deviations: ClinicalDeviation[]): number {
    let score = 100;

    // Deduct points for deviations
    deviations.forEach(deviation => {
      switch (deviation.severity) {
        case 'mild':
          score -= 5;
          break;
        case 'moderate':
          score -= 15;
          break;
        case 'severe':
          score -= 25;
          break;
      }
    });

    // Deduct points for timing abnormalities
    if (cycle.duration < 0.8) score -= 10; // Too fast
    if (cycle.duration > 1.5) score -= 15; // Too slow

    return Math.max(0, score);
  }

  private calculateGaitEfficiency(cycle: GaitCycle): number {
    // Efficiency based on timing optimization
    const idealStancePercent = 60;
    const idealSwingPercent = 40;

    const stancePhase = cycle.phases.initialContact.percentOfCycle +
                       cycle.phases.loadingResponse.percentOfCycle +
                       cycle.phases.midStance.percentOfCycle +
                       cycle.phases.terminalStance.percentOfCycle +
                       cycle.phases.preSwing.percentOfCycle;

    const swingPhase = cycle.phases.initialSwing.percentOfCycle +
                      cycle.phases.midSwing.percentOfCycle +
                      cycle.phases.terminalSwing.percentOfCycle;

    const stanceError = Math.abs(stancePhase - idealStancePercent);
    const swingError = Math.abs(swingPhase - idealSwingPercent);

    const efficiency = 100 - (stanceError + swingError) * 2;
    return Math.max(0, Math.min(100, efficiency));
  }

  private analyzeAsymmetry(leftMetrics: GaitCycleMetrics, rightMetrics: GaitCycleMetrics): AsymmetryAnalysis {
    // Calculate asymmetry indices
    const stepTimeAsymmetry = Math.abs(leftMetrics.stepTime - rightMetrics.stepTime) /
                             ((leftMetrics.stepTime + rightMetrics.stepTime) / 2) * 100;

    const stanceTimeAsymmetry = Math.abs(leftMetrics.stancePhasePercent - rightMetrics.stancePhasePercent);

    const swingTimeAsymmetry = Math.abs(leftMetrics.swingPhasePercent - rightMetrics.swingPhasePercent);

    // Spatial asymmetry (approximation)
    const spatialAsymmetry = Math.abs(leftMetrics.strideTime - rightMetrics.strideTime) /
                            ((leftMetrics.strideTime + rightMetrics.strideTime) / 2) * 100;

    // Temporal asymmetry
    const temporalAsymmetry = (stepTimeAsymmetry + stanceTimeAsymmetry + swingTimeAsymmetry) / 3;

    // Overall asymmetry index
    const overallAsymmetryIndex = (stepTimeAsymmetry + stanceTimeAsymmetry + swingTimeAsymmetry + spatialAsymmetry) / 4;

    // Clinical interpretation
    let clinicalInterpretation = '';
    if (overallAsymmetryIndex < 5) {
      clinicalInterpretation = 'Marcha simétrica dentro de límites normales';
    } else if (overallAsymmetryIndex < 10) {
      clinicalInterpretation = 'Asimetría leve - monitorizar evolución';
    } else if (overallAsymmetryIndex < 20) {
      clinicalInterpretation = 'Asimetría moderada - requiere evaluación clínica';
    } else {
      clinicalInterpretation = 'Asimetría severa - intervención recomendada';
    }

    return {
      stepTimeAsymmetry,
      stanceTimeAsymmetry,
      swingTimeAsymmetry,
      spatialAsymmetry,
      temporalAsymmetry,
      overallAsymmetryIndex,
      clinicalInterpretation
    };
  }

  private identifyBilateralDeviations(leftMetrics: GaitCycleMetrics, rightMetrics: GaitCycleMetrics): ClinicalDeviation[] {
    const deviations: ClinicalDeviation[] = [];

    // Compare corresponding phases
    const phases = [
      { name: 'Initial Contact', left: leftMetrics.initialContactPercent, right: rightMetrics.initialContactPercent },
      { name: 'Loading Response', left: leftMetrics.loadingResponsePercent, right: rightMetrics.loadingResponsePercent },
      { name: 'Mid Stance', left: leftMetrics.midStancePercent, right: rightMetrics.midStancePercent },
      { name: 'Terminal Stance', left: leftMetrics.terminalStancePercent, right: rightMetrics.terminalStancePercent },
      { name: 'Pre Swing', left: leftMetrics.preSwingPercent, right: rightMetrics.preSwingPercent },
      { name: 'Initial Swing', left: leftMetrics.initialSwingPercent, right: rightMetrics.initialSwingPercent },
      { name: 'Mid Swing', left: leftMetrics.midSwingPercent, right: rightMetrics.midSwingPercent },
      { name: 'Terminal Swing', left: leftMetrics.terminalSwingPercent, right: rightMetrics.terminalSwingPercent }
    ];

    phases.forEach(phase => {
      const asymmetry = Math.abs(phase.left - phase.right);
      if (asymmetry > GaitCycleAnalyzer.NORMAL_RANGES.asymmetryThreshold) {
        const severity = asymmetry > 15 ? 'severe' : asymmetry > 10 ? 'moderate' : 'mild';
        deviations.push({
          phase: phase.name,
          deviation: 'Bilateral asymmetry',
          severity,
          description: `Left: ${phase.left.toFixed(1)}%, Right: ${phase.right.toFixed(1)}% (Δ: ${asymmetry.toFixed(1)}%)`,
          clinicalSignificance: 'Asymmetric pattern may indicate unilateral impairment or compensation'
        });
      }
    });

    return deviations;
  }

  public generateCycleReport(comparison: GaitCycleComparison): string {
    let report = '## Análisis del Ciclo de Marcha\n\n';

    // Overall summary
    report += `**Índice de Asimetría Global:** ${comparison.asymmetryAnalysis.overallAsymmetryIndex.toFixed(1)}%\n`;
    report += `**Interpretación:** ${comparison.asymmetryAnalysis.clinicalInterpretation}\n\n`;

    // Left side analysis
    report += '### Pierna Izquierda\n';
    report += `- Tiempo de zancada: ${comparison.leftCycle.strideTime.toFixed(2)}s\n`;
    report += `- Fase de apoyo: ${comparison.leftCycle.stancePhasePercent.toFixed(1)}%\n`;
    report += `- Fase de balanceo: ${comparison.leftCycle.swingPhasePercent.toFixed(1)}%\n`;
    report += `- Puntuación funcional: ${comparison.leftCycle.functionalScore}/100\n\n`;

    // Right side analysis
    report += '### Pierna Derecha\n';
    report += `- Tiempo de zancada: ${comparison.rightCycle.strideTime.toFixed(2)}s\n`;
    report += `- Fase de apoyo: ${comparison.rightCycle.stancePhasePercent.toFixed(1)}%\n`;
    report += `- Fase de balanceo: ${comparison.rightCycle.swingPhasePercent.toFixed(1)}%\n`;
    report += `- Puntuación funcional: ${comparison.rightCycle.functionalScore}/100\n\n`;

    // Deviations
    if (comparison.bilateralDeviations.length > 0) {
      report += '### Desviaciones Clínicas Detectadas\n';
      comparison.bilateralDeviations.forEach(deviation => {
        report += `- **${deviation.phase}:** ${deviation.deviation} (${deviation.severity})\n`;
        report += `  ${deviation.description}\n`;
        report += `  *${deviation.clinicalSignificance}*\n\n`;
      });
    }

    return report;
  }
}