import type {
  OGSScore,
  OGSAnalysis,
  CorrelationAnalysis,
  SessionData,
  FootSide,
  AdvancedMetrics
} from '../types/session.ts';
import type { KinematicSummary } from '../types/session.ts';
import type { CompensationAnalysis } from './compensationDetection.ts';

export class OGSAnalyzer {
  calculateOGSFinalScore(
    leftScore: OGSScore,
    rightScore: OGSScore,
    sessionData: SessionData,
    advancedMetrics?: AdvancedMetrics,
    kinematics?: KinematicSummary,
    compensations?: CompensationAnalysis
  ): OGSAnalysis {
    const leftTotal = this.calculateTotalScore(leftScore);
    const rightTotal = this.calculateTotalScore(rightScore);
    const asymmetryIndex = this.calculateAsymmetryIndex(leftTotal, rightTotal);
    const qualityIndex = this.calculateQualityIndex(leftTotal, rightTotal);

    const interpretations = this.generateInterpretations(
      leftTotal,
      rightTotal,
      asymmetryIndex,
      qualityIndex
    );

    const recommendations = this.generateRecommendations(
      leftTotal,
      rightTotal,
      asymmetryIndex,
      interpretations
    );

    const correlationWithKinematics = this.analyzeKinematicCorrelations(
      leftScore,
      rightScore,
      advancedMetrics,
      kinematics,
      compensations
    );

    return {
      leftScore,
      rightScore,
      leftTotal,
      rightTotal,
      asymmetryIndex,
      qualityIndex,
      interpretations,
      recommendations,
      correlationWithKinematics
    };
  }

  private calculateTotalScore(score: OGSScore): number {
    return Object.values(score).reduce((sum, itemScore) => sum + (itemScore ?? 0), 0);
  }

  private calculateAsymmetryIndex(leftTotal: number, rightTotal: number): number {
    const maxTotal = Math.max(leftTotal, rightTotal);
    if (maxTotal === 0) return 0;
    return (Math.abs(leftTotal - rightTotal) / maxTotal) * 100;
  }

  private calculateQualityIndex(leftTotal: number, rightTotal: number): number {
    const maxPossible = 48; // 24 puntos por pierna
    return ((leftTotal + rightTotal) / maxPossible) * 100;
  }

  private generateInterpretations(
    leftTotal: number,
    rightTotal: number,
    asymmetryIndex: number,
    qualityIndex: number
  ): string[] {
    const interpretations: string[] = [];

    // Interpretación de puntuaciones totales
    if (qualityIndex >= 75) {
      interpretations.push('Patrón de marcha dentro de límites normales según evaluación OGS');
    } else if (qualityIndex >= 50) {
      interpretations.push('Alteraciones moderadas en el patrón de marcha observacional');
    } else if (qualityIndex >= 25) {
      interpretations.push('Alteraciones significativas que requieren intervención especializada');
    } else {
      interpretations.push('Alteraciones severas con impacto funcional considerable');
    }

    // Interpretación de asimetría
    if (asymmetryIndex < 10) {
      interpretations.push('Patrón simétrico bilateral según evaluación observacional');
    } else if (asymmetryIndex < 25) {
      interpretations.push(`Asimetría leve detectada (${asymmetryIndex.toFixed(1)}%)`);
    } else if (asymmetryIndex < 50) {
      interpretations.push(`Asimetría moderada que requiere evaluación (${asymmetryIndex.toFixed(1)}%)`);
    } else {
      interpretations.push(`Asimetría severa que requiere intervención inmediata (${asymmetryIndex.toFixed(1)}%)`);
    }

    // Interpretación específica por extremidad
    if (Math.abs(leftTotal - rightTotal) >= 5) {
      const weakerSide = leftTotal < rightTotal ? 'izquierda' : 'derecha';
      const strongerSide = leftTotal < rightTotal ? 'derecha' : 'izquierda';
      interpretations.push(`Extremidad ${weakerSide} muestra mayor compromiso comparado con extremidad ${strongerSide}`);
    }

    // Interpretación de fiabilidad
    interpretations.push('La evaluación OGS es más confiable para articulaciones distales (rodilla y tobillo)');

    return interpretations;
  }

  private generateRecommendations(
    leftTotal: number,
    rightTotal: number,
    asymmetryIndex: number,
    _interpretations: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Recomendaciones basadas en puntuación total
    const avgTotal = (leftTotal + rightTotal) / 2;
    if (avgTotal < 12) {
      recommendations.push('Derivación urgente a fisioterapia especializada en alteraciones de marcha');
      recommendations.push('Evaluación médica completa para descartar patología subyacente');
      recommendations.push('Consideración de ayudas técnicas para la marcha');
    } else if (avgTotal < 18) {
      recommendations.push('Fisioterapia especializada en reeducación de marcha');
      recommendations.push('Entrenamiento específico de fases alteradas del ciclo');
      recommendations.push('Evaluación periódica del progreso con OGS');
    } else if (avgTotal < 22) {
      recommendations.push('Ejercicios específicos para optimización del patrón de marcha');
      recommendations.push('Seguimiento observacional periódico');
    }

    // Recomendaciones basadas en asimetría
    if (asymmetryIndex > 25) {
      recommendations.push('Entrenamiento específico de simetría bilateral');
      recommendations.push('Evaluación de posibles causas de asimetría (dolor, debilidad, contracturas)');
      if (leftTotal < rightTotal) {
        recommendations.push('Fortalecimiento y reeducación específica de extremidad inferior izquierda');
      } else {
        recommendations.push('Fortalecimiento y reeducación específica de extremidad inferior derecha');
      }
    }

    // Recomendaciones de seguimiento
    recommendations.push('Reevaluación con OGS en 4-8 semanas para monitorear progreso');

    if (avgTotal < 18) {
      recommendations.push('Complementar con análisis instrumental de marcha si está disponible');
    }

    return recommendations;
  }

  private analyzeKinematicCorrelations(
    leftScore: OGSScore,
    rightScore: OGSScore,
    advancedMetrics?: AdvancedMetrics,
    kinematics?: KinematicSummary,
    compensations?: CompensationAnalysis
  ): CorrelationAnalysis[] {
    const correlations: CorrelationAnalysis[] = [];

    if (!advancedMetrics && !kinematics) {
      return correlations;
    }

    // Correlación con métricas avanzadas
    if (advancedMetrics) {
      // Correlación velocidad-puntuación OGS
      const avgOGSScore = ((this.calculateTotalScore(leftScore) + this.calculateTotalScore(rightScore)) / 2);
      if (advancedMetrics.speedMps) {
        if (avgOGSScore < 15 && advancedMetrics.speedMps < 0.8) {
          correlations.push({
            parameter: 'Velocidad de marcha',
            ogsItem: 'midStance',
            foot: 'L',
            correlation: 'positive',
            significance: 'high',
            description: `Baja puntuación OGS (${avgOGSScore.toFixed(1)}) correlaciona con velocidad reducida (${advancedMetrics.speedMps.toFixed(2)} m/s)`
          });
        }
      }

      // Correlación con asimetría de stance
      if (advancedMetrics.stanceAsymmetryPct) {
        const ogsAsymmetry = this.calculateAsymmetryIndex(
          this.calculateTotalScore(leftScore),
          this.calculateTotalScore(rightScore)
        );

        if (ogsAsymmetry > 20 && advancedMetrics.stanceAsymmetryPct > 10) {
          correlations.push({
            parameter: 'Asimetría temporal',
            ogsItem: 'loadingResponse',
            foot: this.calculateTotalScore(leftScore) < this.calculateTotalScore(rightScore) ? 'L' : 'R',
            correlation: 'positive',
            significance: 'high',
            description: `Asimetría observacional (${ogsAsymmetry.toFixed(1)}%) correlaciona con asimetría temporal (${advancedMetrics.stanceAsymmetryPct.toFixed(1)}%)`
          });
        }
      }

      // Correlación con ángulos articulares
      if (advancedMetrics.leftKneeAngle && advancedMetrics.rightKneeAngle) {
        const leftKneeOGS = (leftScore.midStance ?? 0) + (leftScore.terminalStance ?? 0);
        const rightKneeOGS = (rightScore.midStance ?? 0) + (rightScore.terminalStance ?? 0);

        if (leftKneeOGS < 4 && advancedMetrics.leftKneeAngle < 40) {
          correlations.push({
            parameter: 'Flexión de rodilla izquierda',
            ogsItem: 'midStance',
            foot: 'L',
            correlation: 'positive',
            significance: 'medium',
            description: `Puntuación OGS baja en rodilla izquierda correlaciona con flexión reducida (${advancedMetrics.leftKneeAngle.toFixed(1)}°)`
          });
        }

        if (rightKneeOGS < 4 && advancedMetrics.rightKneeAngle < 40) {
          correlations.push({
            parameter: 'Flexión de rodilla derecha',
            ogsItem: 'midStance',
            foot: 'R',
            correlation: 'positive',
            significance: 'medium',
            description: `Puntuación OGS baja en rodilla derecha correlaciona con flexión reducida (${advancedMetrics.rightKneeAngle.toFixed(1)}°)`
          });
        }
      }
    }

    // Correlación con análisis cinemático
    if (kinematics) {
      kinematics.deviations.forEach(deviation => {
        const foot: FootSide = deviation.side === 'left' ? 'L' : 'R';
        const score = foot === 'L' ? leftScore : rightScore;

        // Mapear desviaciones cinemáticas a ítems OGS
        if (deviation.joint === 'knee' && deviation.phase === 'stance') {
          const kneeOGSScore = (score.midStance ?? 0) + (score.terminalStance ?? 0);
          if (kneeOGSScore <= 2 && deviation.severity === 'severe') {
            correlations.push({
              parameter: `Cinemática de rodilla ${deviation.side}`,
              ogsItem: 'midStance',
              foot,
              correlation: 'positive',
              significance: 'high',
              description: `Puntuación OGS baja (${kneeOGSScore}) coincide con desviación cinemática severa: ${deviation.description}`
            });
          }
        }

        if (deviation.joint === 'ankle') {
          const ankleOGSScore = (score.initialFootContact ?? 0) + (score.loadingResponse ?? 0);
          if (ankleOGSScore <= 2 && deviation.severity !== 'normal') {
            correlations.push({
              parameter: `Cinemática de tobillo ${deviation.side}`,
              ogsItem: 'initialFootContact',
              foot,
              correlation: 'positive',
              significance: 'medium',
              description: `Puntuación OGS baja (${ankleOGSScore}) coincide con alteración de tobillo: ${deviation.description}`
            });
          }
        }
      });
    }

    // Correlación con compensaciones
    if (compensations) {
      if (compensations.primaryCompensation) {
        const comp = compensations.primaryCompensation;

        // Mapear compensaciones a puntuaciones OGS
        if (comp.type.includes('trendelenburg')) {
          const avgHipScore = ((leftScore.midStance ?? 0) + (rightScore.midStance ?? 0)) / 2;
          if (avgHipScore < 2) {
            correlations.push({
              parameter: 'Compensación Trendelenburg',
              ogsItem: 'midStance',
              foot: 'L',
              correlation: 'negative',
              significance: 'high',
              description: `Compensación ${comp.type} detectada correlaciona con puntuación OGS baja en fase de apoyo`
            });
          }
        }

        if (comp.type.includes('circumduction')) {
          const avgSwingScore = ((leftScore.initialSwing ?? 0) + (leftScore.midSwing ?? 0) +
                               (rightScore.initialSwing ?? 0) + (rightScore.midSwing ?? 0)) / 4;
          if (avgSwingScore < 2) {
            correlations.push({
              parameter: 'Compensación de circunducción',
              ogsItem: 'midSwing',
              foot: 'L',
              correlation: 'negative',
              significance: 'high',
              description: `Compensación ${comp.type} detectada correlaciona con puntuación OGS baja en fase de balanceo`
            });
          }
        }
      }
    }

    return correlations;
  }

  // Método auxiliar para validar puntuaciones OGS
  validateOGSScores(leftScore: OGSScore, rightScore: OGSScore): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Verificar completitud
    const leftComplete = Object.values(leftScore).filter(score => score !== null).length;
    const rightComplete = Object.values(rightScore).filter(score => score !== null).length;

    if (leftComplete < 8) {
      warnings.push(`Evaluación incompleta en pierna izquierda (${leftComplete}/8 ítems)`);
      suggestions.push('Complete todos los ítems para una evaluación más precisa');
    }

    if (rightComplete < 8) {
      warnings.push(`Evaluación incompleta en pierna derecha (${rightComplete}/8 ítems)`);
      suggestions.push('Complete todos los ítems para una evaluación más precisa');
    }

    // Verificar consistencia
    const leftTotal = this.calculateTotalScore(leftScore);
    const rightTotal = this.calculateTotalScore(rightScore);
    const asymmetry = this.calculateAsymmetryIndex(leftTotal, rightTotal);

    if (asymmetry > 75) {
      warnings.push('Asimetría extrema detectada - verificar puntuaciones');
      suggestions.push('Revisar la evaluación, especialmente los ítems con mayor diferencia entre extremidades');
    }

    // Verificar patrones inusuales
    const leftNegatives = Object.values(leftScore).filter(score => score === -1).length;
    const rightNegatives = Object.values(rightScore).filter(score => score === -1).length;

    if (leftNegatives > 4 || rightNegatives > 4) {
      warnings.push('Múltiples puntuaciones muy alteradas (-1) detectadas');
      suggestions.push('Considerar derivación urgente para evaluación especializada');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    };
  }
}

export const ogsAnalyzer = new OGSAnalyzer();