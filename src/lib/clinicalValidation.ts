export interface NormativeData {
  parameter: string;
  ageGroup: string;
  gender: 'M' | 'F' | 'All';
  mean: number;
  standardDeviation: number;
  percentile5: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile95: number;
  unit: string;
  reference: string;
}

export interface PathologyReference {
  condition: string;
  parameter: string;
  typicalRange: { min: number; max: number };
  severity: {
    mild: { min: number; max: number };
    moderate: { min: number; max: number };
    severe: { min: number; max: number };
  };
  clinicalSignificance: string;
  reference: string;
}

export interface ClinicalInterpretation {
  parameter: string;
  value: number;
  zScore: number;
  percentile: number;
  classification: 'well_below' | 'below' | 'normal' | 'above' | 'well_above';
  clinicalSignificance: string;
  recommendation: string;
}

export class ClinicalValidator {
  private static readonly NORMATIVE_DATABASE: NormativeData[] = [
    // Walking Speed (Perry & Burnfield, 2010; Bohannon & Andrews, 2011)
    {
      parameter: 'walkingSpeed',
      ageGroup: '20-39',
      gender: 'All',
      mean: 1.35,
      standardDeviation: 0.15,
      percentile5: 1.08,
      percentile25: 1.25,
      percentile50: 1.35,
      percentile75: 1.45,
      percentile95: 1.62,
      unit: 'm/s',
      reference: 'Bohannon & Andrews, 2011'
    },
    {
      parameter: 'walkingSpeed',
      ageGroup: '40-59',
      gender: 'All',
      mean: 1.31,
      standardDeviation: 0.16,
      percentile5: 1.03,
      percentile25: 1.20,
      percentile50: 1.31,
      percentile75: 1.42,
      percentile95: 1.59,
      unit: 'm/s',
      reference: 'Bohannon & Andrews, 2011'
    },
    {
      parameter: 'walkingSpeed',
      ageGroup: '60-79',
      gender: 'All',
      mean: 1.22,
      standardDeviation: 0.18,
      percentile5: 0.91,
      percentile25: 1.09,
      percentile50: 1.22,
      percentile75: 1.35,
      percentile95: 1.53,
      unit: 'm/s',
      reference: 'Bohannon & Andrews, 2011'
    },
    {
      parameter: 'walkingSpeed',
      ageGroup: '80+',
      gender: 'All',
      mean: 0.97,
      standardDeviation: 0.21,
      percentile5: 0.62,
      percentile25: 0.82,
      percentile50: 0.97,
      percentile75: 1.12,
      percentile95: 1.32,
      unit: 'm/s',
      reference: 'Bohannon & Andrews, 2011'
    },

    // Cadence (Perry & Burnfield, 2010)
    {
      parameter: 'cadence',
      ageGroup: '20-39',
      gender: 'All',
      mean: 113,
      standardDeviation: 7,
      percentile5: 102,
      percentile25: 108,
      percentile50: 113,
      percentile75: 118,
      percentile95: 124,
      unit: 'steps/min',
      reference: 'Perry & Burnfield, 2010'
    },
    {
      parameter: 'cadence',
      ageGroup: '60-79',
      gender: 'All',
      mean: 109,
      standardDeviation: 9,
      percentile5: 94,
      percentile25: 103,
      percentile50: 109,
      percentile75: 115,
      percentile95: 124,
      unit: 'steps/min',
      reference: 'Perry & Burnfield, 2010'
    },

    // Step Length (Perry & Burnfield, 2010)
    {
      parameter: 'stepLength',
      ageGroup: '20-39',
      gender: 'All',
      mean: 0.63,
      standardDeviation: 0.05,
      percentile5: 0.55,
      percentile25: 0.60,
      percentile50: 0.63,
      percentile75: 0.66,
      percentile95: 0.71,
      unit: 'm',
      reference: 'Perry & Burnfield, 2010'
    },

    // Stance Phase (Perry & Burnfield, 2010)
    {
      parameter: 'stancePhase',
      ageGroup: 'All',
      gender: 'All',
      mean: 60,
      standardDeviation: 2,
      percentile5: 57,
      percentile25: 59,
      percentile50: 60,
      percentile75: 61,
      percentile95: 63,
      unit: '% of cycle',
      reference: 'Perry & Burnfield, 2010'
    },

    // Swing Phase (Perry & Burnfield, 2010)
    {
      parameter: 'swingPhase',
      ageGroup: 'All',
      gender: 'All',
      mean: 40,
      standardDeviation: 2,
      percentile5: 37,
      percentile25: 39,
      percentile50: 40,
      percentile75: 41,
      percentile95: 43,
      unit: '% of cycle',
      reference: 'Perry & Burnfield, 2010'
    },

    // Double Support (Perry & Burnfield, 2010)
    {
      parameter: 'doubleSupport',
      ageGroup: 'All',
      gender: 'All',
      mean: 20,
      standardDeviation: 3,
      percentile5: 15,
      percentile25: 18,
      percentile50: 20,
      percentile75: 22,
      percentile95: 25,
      unit: '% of cycle',
      reference: 'Perry & Burnfield, 2010'
    },

    // Step Time Asymmetry (Plotnik et al., 2007)
    {
      parameter: 'stepTimeAsymmetry',
      ageGroup: 'All',
      gender: 'All',
      mean: 2.1,
      standardDeviation: 1.8,
      percentile5: 0.2,
      percentile25: 0.8,
      percentile50: 1.6,
      percentile75: 2.8,
      percentile95: 5.8,
      unit: '%',
      reference: 'Plotnik et al., 2007'
    }
  ];

  private static readonly PATHOLOGY_REFERENCES: PathologyReference[] = [
    // Stroke (Perry & Burnfield, 2010; Kautz et al., 2011)
    {
      condition: 'Stroke',
      parameter: 'walkingSpeed',
      typicalRange: { min: 0.2, max: 0.8 },
      severity: {
        mild: { min: 0.6, max: 0.8 },
        moderate: { min: 0.4, max: 0.6 },
        severe: { min: 0.2, max: 0.4 }
      },
      clinicalSignificance: 'Walking speed strongly correlates with functional independence and fall risk',
      reference: 'Perry & Burnfield, 2010'
    },
    {
      condition: 'Stroke',
      parameter: 'stepTimeAsymmetry',
      typicalRange: { min: 10, max: 30 },
      severity: {
        mild: { min: 10, max: 15 },
        moderate: { min: 15, max: 25 },
        severe: { min: 25, max: 50 }
      },
      clinicalSignificance: 'High asymmetry indicates unilateral motor impairment and increased fall risk',
      reference: 'Balasubramanian et al., 2007'
    },

    // Parkinson Disease (Morris et al., 2001; Hausdorff et al., 1998)
    {
      condition: 'Parkinson',
      parameter: 'walkingSpeed',
      typicalRange: { min: 0.5, max: 1.0 },
      severity: {
        mild: { min: 0.8, max: 1.0 },
        moderate: { min: 0.6, max: 0.8 },
        severe: { min: 0.3, max: 0.6 }
      },
      clinicalSignificance: 'Bradykinesia manifests as reduced walking speed and stride length',
      reference: 'Morris et al., 2001'
    },
    {
      condition: 'Parkinson',
      parameter: 'stepLength',
      typicalRange: { min: 0.3, max: 0.5 },
      severity: {
        mild: { min: 0.45, max: 0.5 },
        moderate: { min: 0.35, max: 0.45 },
        severe: { min: 0.2, max: 0.35 }
      },
      clinicalSignificance: 'Shortened steps are characteristic of parkinsonian gait',
      reference: 'Morris et al., 2001'
    },

    // Cerebral Palsy (Rodda et al., 2004; Schwartz et al., 2008)
    {
      condition: 'CerebralPalsy',
      parameter: 'walkingSpeed',
      typicalRange: { min: 0.4, max: 1.2 },
      severity: {
        mild: { min: 0.8, max: 1.2 },
        moderate: { min: 0.6, max: 0.8 },
        severe: { min: 0.2, max: 0.6 }
      },
      clinicalSignificance: 'Speed correlates with GMFCS level and functional mobility',
      reference: 'Rodda et al., 2004'
    },

    // Elderly (Hollman et al., 2011)
    {
      condition: 'Elderly',
      parameter: 'walkingSpeed',
      typicalRange: { min: 0.8, max: 1.3 },
      severity: {
        mild: { min: 1.0, max: 1.3 },
        moderate: { min: 0.8, max: 1.0 },
        severe: { min: 0.4, max: 0.8 }
      },
      clinicalSignificance: 'Walking speed <1.0 m/s indicates mobility limitation and increased fall risk',
      reference: 'Studenski et al., 2011'
    }
  ];

  public static interpretParameter(
    parameter: string,
    value: number,
    age?: number,
    gender?: 'M' | 'F'
  ): ClinicalInterpretation {
    // Find appropriate normative data
    const ageGroup = this.getAgeGroup(age || 30);
    const normativeData = this.NORMATIVE_DATABASE.find(
      data => data.parameter === parameter &&
              (data.ageGroup === ageGroup || data.ageGroup === 'All') &&
              (data.gender === gender || data.gender === 'All')
    );

    if (!normativeData) {
      return {
        parameter,
        value,
        zScore: 0,
        percentile: 50,
        classification: 'normal',
        clinicalSignificance: 'Datos normativos no disponibles para este parámetro',
        recommendation: 'Comparar con referencias clínicas específicas'
      };
    }

    // Calculate z-score
    const zScore = (value - normativeData.mean) / normativeData.standardDeviation;

    // Calculate percentile (approximation using z-score)
    const percentile = this.zScoreToPercentile(zScore);

    // Classify based on z-score
    let classification: ClinicalInterpretation['classification'];
    let clinicalSignificance: string;
    let recommendation: string;

    if (zScore < -2) {
      classification = 'well_below';
      clinicalSignificance = 'Valor significativamente por debajo de la norma poblacional';
      recommendation = 'Evaluación clínica detallada recomendada';
    } else if (zScore < -1) {
      classification = 'below';
      clinicalSignificance = 'Valor por debajo del rango normal';
      recommendation = 'Monitorizar evolución y considerar intervención';
    } else if (zScore > 2) {
      classification = 'well_above';
      clinicalSignificance = 'Valor significativamente por encima de la norma';
      recommendation = 'Evaluar factores contribuyentes';
    } else if (zScore > 1) {
      classification = 'above';
      clinicalSignificance = 'Valor por encima del rango normal';
      recommendation = 'Dentro de variabilidad normal o compensación';
    } else {
      classification = 'normal';
      clinicalSignificance = 'Valor dentro del rango normal para la población';
      recommendation = 'Continuar monitoreo de rutina';
    }

    return {
      parameter,
      value,
      zScore,
      percentile,
      classification,
      clinicalSignificance,
      recommendation
    };
  }

  public static assessPathologyCompatibility(
    parameter: string,
    value: number,
    suspectedCondition: string
  ): {
    compatible: boolean;
    severity: 'mild' | 'moderate' | 'severe' | 'not_applicable';
    confidence: number;
    explanation: string;
  } {
    const pathologyRef = this.PATHOLOGY_REFERENCES.find(
      ref => ref.condition === suspectedCondition && ref.parameter === parameter
    );

    if (!pathologyRef) {
      return {
        compatible: false,
        severity: 'not_applicable',
        confidence: 0,
        explanation: `No hay datos de referencia para ${parameter} en ${suspectedCondition}`
      };
    }

    // Check if value is within typical range for condition
    const withinTypicalRange = value >= pathologyRef.typicalRange.min &&
                              value <= pathologyRef.typicalRange.max;

    if (!withinTypicalRange) {
      return {
        compatible: false,
        severity: 'not_applicable',
        confidence: 0.1,
        explanation: `Valor fuera del rango típico para ${suspectedCondition}`
      };
    }

    // Determine severity
    let severity: 'mild' | 'moderate' | 'severe' = 'mild';
    let confidence = 0.5;

    if (value >= pathologyRef.severity.severe.min && value <= pathologyRef.severity.severe.max) {
      severity = 'severe';
      confidence = 0.9;
    } else if (value >= pathologyRef.severity.moderate.min && value <= pathologyRef.severity.moderate.max) {
      severity = 'moderate';
      confidence = 0.7;
    } else if (value >= pathologyRef.severity.mild.min && value <= pathologyRef.severity.mild.max) {
      severity = 'mild';
      confidence = 0.6;
    }

    return {
      compatible: true,
      severity,
      confidence,
      explanation: `${pathologyRef.clinicalSignificance}. Severidad: ${severity}.`
    };
  }

  public static generateClinicalReport(interpretations: ClinicalInterpretation[]): string {
    let report = '## Interpretación Clínica Basada en Evidencia\n\n';

    // Summary statistics
    const abnormalCount = interpretations.filter(
      i => i.classification === 'below' || i.classification === 'well_below' ||
           i.classification === 'above' || i.classification === 'well_above'
    ).length;

    report += `**Parámetros evaluados:** ${interpretations.length}\n`;
    report += `**Parámetros fuera de rango normal:** ${abnormalCount}\n\n`;

    // Critical findings
    const criticalFindings = interpretations.filter(i => i.classification === 'well_below' || i.classification === 'well_above');
    if (criticalFindings.length > 0) {
      report += '### 🚨 Hallazgos Críticos\n';
      criticalFindings.forEach(finding => {
        report += `- **${finding.parameter}:** ${finding.value} (Z-score: ${finding.zScore.toFixed(2)})\n`;
        report += `  ${finding.clinicalSignificance}\n`;
        report += `  *Recomendación: ${finding.recommendation}*\n\n`;
      });
    }

    // Detailed analysis
    report += '### Análisis Detallado\n\n';
    interpretations.forEach(interpretation => {
      const icon = this.getClassificationIcon(interpretation.classification);
      report += `${icon} **${interpretation.parameter}**\n`;
      report += `- Valor: ${interpretation.value}\n`;
      report += `- Percentil: ${interpretation.percentile}º\n`;
      report += `- Z-score: ${interpretation.zScore.toFixed(2)}\n`;
      report += `- Significado: ${interpretation.clinicalSignificance}\n`;
      report += `- Recomendación: ${interpretation.recommendation}\n\n`;
    });

    // References
    report += '### Referencias Clínicas\n';
    report += '- Perry J, Burnfield JM. Gait Analysis: Normal and Pathological Function. 2nd ed. 2010\n';
    report += '- Bohannon RW, Andrews AW. Normal walking speed: a descriptive meta-analysis. Physiotherapy. 2011\n';
    report += '- Plotnik M, Giladi N, Hausdorff JM. A new measure for quantifying the bilateral coordination of human gait. Exp Brain Res. 2007\n';

    return report;
  }

  private static getAgeGroup(age: number): string {
    if (age < 20) return '20-39'; // Use young adult norms for children/adolescents
    if (age < 40) return '20-39';
    if (age < 60) return '40-59';
    if (age < 80) return '60-79';
    return '80+';
  }

  private static zScoreToPercentile(zScore: number): number {
    // Approximation using cumulative distribution function
    const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
    const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
    const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    if (zScore >= 0) {
      return Math.round((1 - probability) * 100);
    } else {
      return Math.round(probability * 100);
    }
  }

  private static getClassificationIcon(classification: ClinicalInterpretation['classification']): string {
    switch (classification) {
      case 'well_below': return '🔴';
      case 'below': return '🟡';
      case 'normal': return '🟢';
      case 'above': return '🟡';
      case 'well_above': return '🔴';
      default: return '⚪';
    }
  }

  // Utility method to get all available normative data
  public static getNormativeData(): NormativeData[] {
    return [...this.NORMATIVE_DATABASE];
  }

  // Utility method to get pathology references
  public static getPathologyReferences(): PathologyReference[] {
    return [...this.PATHOLOGY_REFERENCES];
  }

  // Method to validate if a parameter value is clinically significant
  public static isClinicallySignificant(
    parameter: string,
    value: number,
    age?: number,
    gender?: 'M' | 'F'
  ): boolean {
    const interpretation = this.interpretParameter(parameter, value, age, gender);
    return interpretation.classification === 'well_below' || interpretation.classification === 'well_above';
  }
}