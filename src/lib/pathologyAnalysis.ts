import type {
  AdvancedMetrics,
  GaitCycle,
  CompensationPattern,
  KinematicData
} from '../types/session.ts';

export interface PathologyIndicators {
  condition: string;
  confidence: number;
  evidence: string[];
  severity: 'mild' | 'moderate' | 'severe';
  recommendations: string[];
}

export interface PathologyAnalysis {
  primaryFindings: PathologyIndicators[];
  differentialDiagnosis: PathologyIndicators[];
  riskFactors: {
    fallRisk: number;
    mobilityLevel: 'independent' | 'assisted' | 'dependent';
    progressionRisk: number;
  };
  interventionPriorities: string[];
  monitoringParameters: string[];
}

interface PathologyPattern {
  name: string;
  // kinematics: {
  //   sagittal?: Partial<KinematicData>;
  //   frontal?: Partial<KinematicData>;
  // };
  compensations: string[];
  gaitEvents: {
    heelStrike?: { timing: number; severity: number };
    toeOff?: { timing: number; severity: number };
    stancePhase?: { duration: number; asymmetry: number };
  };
  spatiotemporal: {
    speedMps?: { min: number; max: number };
    cadenceSpm?: { min: number; max: number };
    gaitSymmetryIndex?: { min: number; max: number };
  };
}

const PATHOLOGY_PATTERNS: Record<string, PathologyPattern> = {
  stroke: {
    name: 'Accidente Cerebrovascular (ACV)',
    // kinematics: {
    //   sagittal: {
    //     hipFlexion: { peak: { value: 15, normal: 30 } },
    //     kneeFlexion: { peak: { value: 35, normal: 60 } },
    //     ankleFlexion: { peak: { value: -5, normal: 10 } }
    //   },
    //   frontal: {
    //     hipAbduction: { peak: { value: 12, normal: 5 } },
    //     kneeAbduction: { peak: { value: 8, normal: 2 } }
    //   }
    // },
    compensations: [
      'Circumducción de cadera',
      'Marcha en tijera',
      'Pie equino',
      'Rodilla hiperextendida'
    ],
    gaitEvents: {
      heelStrike: { timing: 0.15, severity: 0.8 },
      toeOff: { timing: 0.65, severity: 0.7 },
      stancePhase: { duration: 0.7, asymmetry: 0.3 }
    },
    spatiotemporal: {
      speedMps: { min: 0.3, max: 0.8 },
      cadenceSpm: { min: 60, max: 90 },
      gaitSymmetryIndex: { min: 0.2, max: 1.0 }
    }
  },

  parkinsons: {
    name: 'Enfermedad de Parkinson',
    // kinematics: {
    //   sagittal: {
    //     hipFlexion: { peak: { value: 20, normal: 30 } },
    //     kneeFlexion: { peak: { value: 40, normal: 60 } },
    //     ankleFlexion: { peak: { value: 5, normal: 10 } }
    //   }
    // },
    compensations: [
      'Pasos cortos',
      'Arrastre de pies',
      'Postura encorvada',
      'Brazo rígido',
      'Festinación'
    ],
    gaitEvents: {
      heelStrike: { timing: 0.12, severity: 0.6 },
      toeOff: { timing: 0.58, severity: 0.5 }
    },
    spatiotemporal: {
      speedMps: { min: 0.4, max: 0.9 },
      cadenceSpm: { min: 80, max: 120 },
      gaitSymmetryIndex: { min: 0.1, max: 0.5 }
    }
  },

  cerebralPalsy: {
    name: 'Parálisis Cerebral',
    // kinematics: {
    //   sagittal: {
    //     hipFlexion: { peak: { value: 45, normal: 30 } },
    //     kneeFlexion: { peak: { value: 80, normal: 60 } },
    //     ankleFlexion: { peak: { value: -10, normal: 10 } }
    //   },
    //   frontal: {
    //     hipAbduction: { peak: { value: 15, normal: 5 } },
    //     kneeAbduction: { peak: { value: 12, normal: 2 } }
    //   }
    // },
    compensations: [
      'Marcha en tijera',
      'Pie equino',
      'Flexión excesiva de rodilla',
      'Rotación interna de cadera',
      'Marcha en puntas'
    ],
    gaitEvents: {
      heelStrike: { timing: 0.18, severity: 0.9 },
      toeOff: { timing: 0.72, severity: 0.8 },
      stancePhase: { duration: 0.75, asymmetry: 0.25 }
    },
    spatiotemporal: {
      speedMps: { min: 0.2, max: 0.7 },
      cadenceSpm: { min: 50, max: 100 },
      gaitSymmetryIndex: { min: 0.3, max: 1.0 }
    }
  },

  ms: {
    name: 'Esclerosis Múltiple',
    // kinematics: {
    //   sagittal: {
    //     hipFlexion: { peak: { value: 25, normal: 30 } },
    //     kneeFlexion: { peak: { value: 45, normal: 60 } },
    //     ankleFlexion: { peak: { value: 0, normal: 10 } }
    //   }
    // },
    compensations: [
      'Arrastre de pies',
      'Circunducción',
      'Fatiga progresiva',
      'Ataxia',
      'Espasticidad variable'
    ],
    gaitEvents: {
      heelStrike: { timing: 0.13, severity: 0.7 },
      toeOff: { timing: 0.62, severity: 0.6 },
      stancePhase: { duration: 0.68, asymmetry: 0.2 }
    },
    spatiotemporal: {
      speedMps: { min: 0.3, max: 0.8 },
      cadenceSpm: { min: 70, max: 100 },
      gaitSymmetryIndex: { min: 0.15, max: 0.8 }
    }
  },

  spinalCord: {
    name: 'Lesión Medular Incompleta',
    // kinematics: {
    //   sagittal: {
    //     hipFlexion: { peak: { value: 20, normal: 30 } },
    //     kneeFlexion: { peak: { value: 30, normal: 60 } },
    //     ankleFlexion: { peak: { value: -5, normal: 10 } }
    //   }
    // },
    compensations: [
      'Circunducción bilateral',
      'Marcha con apoyo',
      'Pérdida de control postural',
      'Espasticidad',
      'Pie péndulo'
    ],
    gaitEvents: {
      heelStrike: { timing: 0.20, severity: 0.9 },
      toeOff: { timing: 0.75, severity: 0.8 },
      stancePhase: { duration: 0.8, asymmetry: 0.4 }
    },
    spatiotemporal: {
      speedMps: { min: 0.1, max: 0.5 },
      cadenceSpm: { min: 40, max: 80 },
      gaitSymmetryIndex: { min: 0.4, max: 1.0 }
    }
  }
};

export class PathologyAnalyzer {
  analyzePathologyIndicators(
    metrics: AdvancedMetrics,
    cycles: GaitCycle[],
    compensations: CompensationPattern[],
    _kinematics?: KinematicData
  ): PathologyAnalysis {
    const findings: PathologyIndicators[] = [];
    const differentials: PathologyIndicators[] = [];

    Object.entries(PATHOLOGY_PATTERNS).forEach(([key, pattern]) => {
      const score = this.calculatePathologyScore(
        pattern,
        metrics,
        cycles,
        compensations
      );

      const indicators: PathologyIndicators = {
        condition: pattern.name,
        confidence: score.confidence,
        evidence: score.evidence,
        severity: this.determineSeverity(score.confidence, score.deviationMagnitude),
        recommendations: this.generateRecommendations(key, score.confidence)
      };

      if (score.confidence > 0.7) {
        findings.push(indicators);
      } else if (score.confidence > 0.4) {
        differentials.push(indicators);
      }
    });

    const riskFactors = this.assessRiskFactors(metrics, compensations, findings);
    const interventionPriorities = this.prioritizeInterventions(findings, compensations);
    const monitoringParameters = this.defineMonitoring(findings, metrics);

    return {
      primaryFindings: findings.sort((a, b) => b.confidence - a.confidence),
      differentialDiagnosis: differentials.sort((a, b) => b.confidence - a.confidence),
      riskFactors,
      interventionPriorities,
      monitoringParameters
    };
  }

  private calculatePathologyScore(
    pattern: PathologyPattern,
    metrics: AdvancedMetrics,
    cycles: GaitCycle[],
    compensations: CompensationPattern[]
  ): { confidence: number; evidence: string[]; deviationMagnitude: number } {
    const evidence: string[] = [];
    let totalScore = 0;
    let maxScore = 0;
    let deviationSum = 0;
    let deviationCount = 0;

    // Análisis espaciotemporal
    if (pattern.spatiotemporal.speedMps && metrics.speedMps) {
      maxScore += 20;
      const { min, max } = pattern.spatiotemporal.speedMps;
      if (metrics.speedMps >= min && metrics.speedMps <= max) {
        totalScore += 20;
        evidence.push(`Velocidad característica: ${metrics.speedMps.toFixed(2)} m/s`);
      }
      deviationSum += Math.abs(metrics.speedMps - (min + max) / 2);
      deviationCount++;
    }

    if (pattern.spatiotemporal.cadenceSpm && metrics.cadenceSpm) {
      maxScore += 15;
      const { min, max } = pattern.spatiotemporal.cadenceSpm;
      if (metrics.cadenceSpm >= min && metrics.cadenceSpm <= max) {
        totalScore += 15;
        evidence.push(`Cadencia característica: ${metrics.cadenceSpm} pasos/min`);
      }
      deviationSum += Math.abs(metrics.cadenceSpm - (min + max) / 2);
      deviationCount++;
    }

    if (pattern.spatiotemporal.gaitSymmetryIndex && metrics.gaitSymmetryIndex) {
      maxScore += 15;
      if (metrics.gaitSymmetryIndex <= pattern.spatiotemporal.gaitSymmetryIndex.min) {
        totalScore += 15;
        evidence.push(`Asimetría de paso: ${(metrics.gaitSymmetryIndex * 100).toFixed(1)}%`);
      }
      deviationSum += Math.abs(metrics.gaitSymmetryIndex - pattern.spatiotemporal.gaitSymmetryIndex.min);
      deviationCount++;
    }

    // Análisis de compensaciones
    maxScore += 25;
    const matchingCompensations = compensations.filter(comp =>
      pattern.compensations.some(patternComp =>
        comp.name.toLowerCase().includes(patternComp.toLowerCase()) ||
        patternComp.toLowerCase().includes(comp.name.toLowerCase())
      )
    );

    const compensationScore = Math.min(25, (matchingCompensations.length / pattern.compensations.length) * 25);
    totalScore += compensationScore;

    if (matchingCompensations.length > 0) {
      evidence.push(`Compensaciones detectadas: ${matchingCompensations.map(c => c.name).join(', ')}`);
    }

    // Análisis de eventos de marcha
    if (pattern.gaitEvents.stancePhase && cycles.length > 0) {
      maxScore += 15;
      const avgStanceDuration = cycles.reduce((sum, cycle) => {
        // Use the stance duration ratio directly from the cycle duration
        return sum + cycle.duration * 0.6; // Default stance duration ~60%
      }, 0) / cycles.length;
      const avgCycleDuration = cycles.reduce((sum, cycle) => sum + cycle.duration, 0) / cycles.length;
      const normalizedStance = avgCycleDuration > 0 ? avgStanceDuration / avgCycleDuration : 0;

      if (Math.abs(normalizedStance - pattern.gaitEvents.stancePhase.duration) < 0.1) {
        totalScore += 15;
        evidence.push(`Duración de apoyo característica: ${(normalizedStance * 100).toFixed(1)}%`);
      }
      deviationSum += Math.abs(normalizedStance - pattern.gaitEvents.stancePhase.duration);
      deviationCount++;
    }

    // Análisis cinemático
    // if (kinematics && pattern.kinematics.sagittal) {
    //   maxScore += 10;
    //   let kinematicMatches = 0;
    //   const kinematicChecks = Object.keys(pattern.kinematics.sagittal).length;
    //
    //   Object.entries(pattern.kinematics.sagittal).forEach(([joint, expected]) => {
    //     const actual = kinematics.sagittal?.[joint as keyof typeof kinematics.sagittal];
    //     if (actual && expected.peak && actual.peak) {
    //       const deviation = Math.abs(actual.peak.value - expected.peak.value);
    //       const normalDeviation = Math.abs(expected.peak.value - expected.peak.normal);
    //
    //       if (deviation < normalDeviation * 0.5) {
    //         kinematicMatches++;
    //       }
    //       deviationSum += deviation;
    //       deviationCount++;
    //     }
    //   });
    //
    //   totalScore += (kinematicMatches / kinematicChecks) * 10;
    //   if (kinematicMatches > 0) {
    //     evidence.push(`Patrones cinemáticos compatibles en ${kinematicMatches}/${kinematicChecks} articulaciones`);
    //   }
    // }

    const confidence = maxScore > 0 ? totalScore / maxScore : 0;
    const deviationMagnitude = deviationCount > 0 ? deviationSum / deviationCount : 0;

    return { confidence, evidence, deviationMagnitude };
  }

  private determineSeverity(confidence: number, deviationMagnitude: number): 'mild' | 'moderate' | 'severe' {
    if (confidence > 0.8 && deviationMagnitude > 20) return 'severe';
    if (confidence > 0.6 && deviationMagnitude > 10) return 'moderate';
    return 'mild';
  }

  private generateRecommendations(pathologyKey: string, confidence: number): string[] {
    const baseRecommendations: Record<string, string[]> = {
      stroke: [
        'Evaluación neurológica especializada',
        'Fisioterapia neuromuscular',
        'Entrenamiento de marcha asistida',
        'Valoración ortésica para pie caído',
        'Terapia ocupacional para AVD'
      ],
      parkinsons: [
        'Evaluación neurológica por especialista en movimientos',
        'Optimización farmacológica',
        'Fisioterapia específica para Parkinson',
        'Entrenamiento de marcha con señales externas',
        'Ejercicios de equilibrio y coordinación'
      ],
      cerebralPalsy: [
        'Evaluación ortopédica pediátrica',
        'Análisis instrumental de marcha',
        'Fisioterapia neuromuscular intensiva',
        'Valoración quirúrgica si indicada',
        'Terapia ocupacional especializada'
      ],
      ms: [
        'Seguimiento neurológico regular',
        'Manejo de fatiga y espasticidad',
        'Fisioterapia adaptada',
        'Entrenamiento de resistencia',
        'Evaluación de ayudas técnicas'
      ],
      spinalCord: [
        'Evaluación médica rehabilitadora',
        'Entrenamiento de marcha con exoesqueleto',
        'Fortalecimiento muscular selectivo',
        'Manejo de espasticidad',
        'Adaptación del entorno'
      ]
    };

    const recommendations = baseRecommendations[pathologyKey] || [];

    if (confidence > 0.8) {
      recommendations.unshift('Derivación urgente a especialista');
    } else if (confidence > 0.6) {
      recommendations.unshift('Evaluación especializada recomendada');
    }

    return recommendations;
  }

  private assessRiskFactors(
    metrics: AdvancedMetrics,
    compensations: CompensationPattern[],
    findings: PathologyIndicators[]
  ): PathologyAnalysis['riskFactors'] {
    let fallRisk = 0;
    let mobilityLevel: 'independent' | 'assisted' | 'dependent' = 'independent';
    let progressionRisk = 0;

    // Evaluación del riesgo de caídas
    if (metrics.speedMps && metrics.speedMps < 0.6) fallRisk += 30;
    if (metrics.cadenceSpm && metrics.cadenceSpm < 80) fallRisk += 20;
    if (metrics.stanceAsymmetryPct && metrics.stanceAsymmetryPct > 20) fallRisk += 25;

    const balanceCompensations = compensations.filter(c =>
      c.name.includes('pérdida') || c.name.includes('inestabilidad') ||
      c.name.includes('Trendelenburg') || c.name.includes('lateral')
    );
    fallRisk += balanceCompensations.length * 15;

    // Evaluación del nivel de movilidad
    if ((metrics.speedMps && metrics.speedMps < 0.4) || compensations.length > 5) {
      mobilityLevel = 'dependent';
    } else if ((metrics.speedMps && metrics.speedMps < 0.8) || compensations.length > 2) {
      mobilityLevel = 'assisted';
    }

    // Evaluación del riesgo de progresión
    const neurologicalFindings = findings.filter(f =>
      f.condition.includes('Parkinson') || f.condition.includes('Esclerosis') ||
      f.condition.includes('ACV')
    );

    if (neurologicalFindings.length > 0) {
      progressionRisk = neurologicalFindings.reduce((sum, f) => sum + f.confidence, 0) / neurologicalFindings.length * 100;
    }

    return {
      fallRisk: Math.min(100, fallRisk),
      mobilityLevel,
      progressionRisk: Math.min(100, progressionRisk)
    };
  }

  private prioritizeInterventions(
    findings: PathologyIndicators[],
    compensations: CompensationPattern[]
  ): string[] {
    const priorities: string[] = [];

    // Prioridades basadas en hallazgos principales
    findings.forEach(finding => {
      if (finding.severity === 'severe') {
        priorities.push(`Manejo urgente de ${finding.condition}`);
      } else if (finding.severity === 'moderate') {
        priorities.push(`Tratamiento de ${finding.condition}`);
      }
    });

    // Prioridades basadas en compensaciones críticas
    const criticalCompensations = compensations.filter(c => c.magnitude > 0.7);
    if (criticalCompensations.length > 0) {
      priorities.push('Corrección de compensaciones críticas');
    }

    // Prioridades generales
    priorities.push('Entrenamiento de marcha funcional');
    priorities.push('Fortalecimiento muscular específico');
    priorities.push('Mejora del equilibrio y coordinación');

    return priorities.slice(0, 5); // Limitar a 5 prioridades principales
  }

  private defineMonitoring(findings: PathologyIndicators[], metrics: AdvancedMetrics): string[] {
    const parameters: string[] = [
      'Velocidad de marcha',
      'Simetría temporal',
      'Patrón de compensaciones'
    ];

    findings.forEach(finding => {
      if (finding.condition.includes('Parkinson')) {
        parameters.push('Rigidez y bradicinesia', 'Respuesta a medicación');
      } else if (finding.condition.includes('ACV')) {
        parameters.push('Recuperación neurológica', 'Espasticidad');
      } else if (finding.condition.includes('Esclerosis')) {
        parameters.push('Fatiga', 'Progresión de síntomas');
      }
    });

    if (metrics.speedMps && metrics.speedMps < 0.6) {
      parameters.push('Riesgo de caídas');
    }

    return [...new Set(parameters)].slice(0, 8); // Eliminar duplicados y limitar
  }
}

export const pathologyAnalyzer = new PathologyAnalyzer();