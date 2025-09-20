import type { AdvancedMetrics, OGSAnalysis } from '../types/session.ts';
import type { KinematicSummary } from './kinematicAnalysis.ts';
import type { CompensationAnalysis } from './compensationDetection.ts';
import type { FrontalMetrics } from './frontalAnalysis.ts';
import type { GaitCycleComparison } from './gaitCycleAnalysis.ts';
import type { PathologyAnalysis } from './pathologyAnalysis.ts';
import { ClinicalValidator } from './clinicalValidation.ts';
import { pathologyAnalyzer } from './pathologyAnalysis.ts';

export interface MedicalReport {
  header: ReportHeader;
  clinicalFindings: ClinicalFindings;
  kinematicAnalysis: KinematicAnalysisSection;
  compensationAnalysis: CompensationAnalysisSection;
  pathologyAnalysis: PathologyAnalysis;
  ogsAnalysis: OGSAnalysisSection;
  functionalAssessment: FunctionalAssessment;
  clinicalImpression: ClinicalImpression;
  recommendations: Recommendations;
  followUp: FollowUpPlan;
  references: string[];
}

export interface ReportHeader {
  patientInfo: {
    identifier: string;
    age?: number;
    gender?: 'M' | 'F';
    diagnosis?: string;
    referringPhysician?: string;
  };
  assessmentInfo: {
    date: string;
    assessor: string;
    facility: string;
    equipmentUsed: string;
    protocolVersion: string;
  };
  analysisMetadata: {
    viewMode: string;
    captureQuality: string;
    processingTime: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
}

export interface ClinicalFindings {
  primaryFindings: Finding[];
  secondaryFindings: Finding[];
  normalFindings: Finding[];
  criticalFindings: Finding[];
  overallSummary: string;
}

export interface Finding {
  parameter: string;
  value: number | string;
  normalRange: string;
  clinicalSignificance: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';
  description: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D';
}

export interface KinematicAnalysisSection {
  sagittalPlane: PlaneAnalysis;
  frontalPlane: PlaneAnalysis;
  spatiotemporalParameters: SpatiotemporalAnalysis;
  gaitCycleAnalysis: GaitCycleAnalysisReport;
}

export interface PlaneAnalysis {
  findings: Finding[];
  deviations: string[];
  functionalImpact: string;
}

export interface SpatiotemporalAnalysis {
  walkingSpeed: Finding;
  cadence: Finding;
  stepLength: Finding;
  asymmetryIndex: Finding;
  summary: string;
}

export interface GaitCycleAnalysisReport {
  phaseAnalysis: string;
  timingAbnormalities: string[];
  bilateralComparison: string;
  functionalImplications: string;
}

export interface CompensationAnalysisSection {
  primaryCompensations: string[];
  secondaryCompensations: string[];
  biomechanicalCauses: string[];
  functionalImpact: string;
  interventionPriorities: string[];
}

export interface OGSAnalysisSection {
  leftTotal: number | null;
  rightTotal: number | null;
  asymmetryIndex: number | null;
  qualityIndex: number | null;
  overallInterpretation: string;
  specificFindings: OGSFinding[];
  correlationSummary: string;
  reliabilityNotes: string;
  clinicalRecommendations: string[];
}

export interface OGSFinding {
  phase: string;
  leftScore: number | null;
  rightScore: number | null;
  interpretation: string;
  clinicalSignificance: 'normal' | 'mild' | 'moderate' | 'severe';
}

export interface FunctionalAssessment {
  mobilityLevel: 'independent' | 'assisted' | 'dependent';
  fallRisk: 'low' | 'moderate' | 'high' | 'very_high';
  energyEfficiency: 'normal' | 'mildly_reduced' | 'moderately_reduced' | 'severely_reduced';
  functionalScore: number; // 0-100
  communityAmbulation: 'unlimited' | 'limited' | 'household_only' | 'non_functional';
  assistiveDeviceRecommendation: string | null;
}

export interface ClinicalImpression {
  primaryDiagnosis: string;
  differentialDiagnosis: string[];
  severity: 'mild' | 'moderate' | 'severe';
  prognosis: 'excellent' | 'good' | 'fair' | 'poor';
  keyPoints: string[];
  clinicalCorrelation: string;
}

export interface Recommendations {
  immediate: RecommendationItem[];
  shortTerm: RecommendationItem[];
  longTerm: RecommendationItem[];
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

export interface RecommendationItem {
  category: 'medical' | 'therapy' | 'surgical' | 'assistive_device' | 'lifestyle' | 'monitoring';
  intervention: string;
  rationale: string;
  expectedOutcome: string;
  timeframe: string;
  provider: string;
}

export interface FollowUpPlan {
  nextAssessment: string;
  monitoringParameters: string[];
  outcomeMetrics: string[];
  progressIndicators: string[];
  alertCriteria: string[];
}

export class MedicalReportGenerator {
  public generateComprehensiveReport(
    basicMetrics: AdvancedMetrics,
    kinematicSummary?: KinematicSummary,
    compensationAnalysis?: CompensationAnalysis,
    frontalMetrics?: FrontalMetrics,
    cycleAnalysis?: GaitCycleComparison,
    gaitCycles?: any[],
    kinematics?: any,
    ogsAnalysis?: OGSAnalysis,
    patientInfo: Partial<ReportHeader['patientInfo']> = {}
  ): MedicalReport {

    const header = this.generateHeader(patientInfo);
    const clinicalFindings = this.generateClinicalFindings(basicMetrics, kinematicSummary);
    const kinematicAnalysis = this.generateKinematicAnalysis(kinematicSummary, frontalMetrics, cycleAnalysis);
    const compensationAnalysisSection = this.generateCompensationAnalysis(compensationAnalysis);

    // Generate pathology analysis
    const pathologyAnalysis = this.generatePathologyAnalysis(
      basicMetrics,
      gaitCycles,
      compensationAnalysis,
      kinematics
    );

    // Generate OGS analysis section
    const ogsAnalysisSection = this.generateOGSAnalysis(ogsAnalysis);

    const functionalAssessment = this.generateFunctionalAssessment(basicMetrics, compensationAnalysis);
    const clinicalImpression = this.generateClinicalImpression(clinicalFindings, compensationAnalysis, pathologyAnalysis, ogsAnalysis);
    const recommendations = this.generateRecommendations(clinicalImpression, functionalAssessment, compensationAnalysis, pathologyAnalysis, ogsAnalysis);
    const followUp = this.generateFollowUpPlan(clinicalImpression, recommendations);

    return {
      header,
      clinicalFindings,
      kinematicAnalysis,
      compensationAnalysis: compensationAnalysisSection,
      pathologyAnalysis,
      ogsAnalysis: ogsAnalysisSection,
      functionalAssessment,
      clinicalImpression,
      recommendations,
      followUp,
      references: this.generateReferences()
    };
  }

  private generateHeader(patientInfo: Partial<ReportHeader['patientInfo']>): ReportHeader {
    return {
      patientInfo: {
        identifier: patientInfo.identifier || 'N/A',
        age: patientInfo.age,
        gender: patientInfo.gender,
        diagnosis: patientInfo.diagnosis,
        referringPhysician: patientInfo.referringPhysician
      },
      assessmentInfo: {
        date: new Date().toLocaleDateString('es-ES'),
        assessor: 'Sistema de Análisis de Marcha GaitTest',
        facility: 'Análisis Digital de Marcha',
        equipmentUsed: 'Videoanálisis con IA + Pose Estimation',
        protocolVersion: 'v2.0'
      },
      analysisMetadata: {
        viewMode: 'Lateral/Frontal',
        captureQuality: 'Alta',
        processingTime: 0,
        confidenceLevel: 'high'
      }
    };
  }

  private generateClinicalFindings(
    metrics: AdvancedMetrics,
    _kinematicSummary?: KinematicSummary
  ): ClinicalFindings {
    const findings: Finding[] = [];

    // Analyze walking speed
    const speedInterpretation = ClinicalValidator.interpretParameter('walkingSpeed', metrics.speedMps || 0);
    findings.push({
      parameter: 'Velocidad de marcha',
      value: `${(metrics.speedMps || 0).toFixed(2)} m/s`,
      normalRange: '1.2-1.4 m/s',
      clinicalSignificance: this.mapZScoreToSignificance(speedInterpretation.zScore),
      description: speedInterpretation.clinicalSignificance,
      evidenceLevel: 'A'
    });

    // Analyze cadence
    const cadenceInterpretation = ClinicalValidator.interpretParameter('cadence', metrics.cadenceSpm || 0);
    findings.push({
      parameter: 'Cadencia',
      value: `${(metrics.cadenceSpm || 0).toFixed(0)} pasos/min`,
      normalRange: '100-120 pasos/min',
      clinicalSignificance: this.mapZScoreToSignificance(cadenceInterpretation.zScore),
      description: cadenceInterpretation.clinicalSignificance,
      evidenceLevel: 'A'
    });

    // Analyze asymmetry
    const asymmetryInterpretation = ClinicalValidator.interpretParameter('stepTimeAsymmetry', metrics.stanceAsymmetryPct || 0);
    findings.push({
      parameter: 'Asimetría de apoyo',
      value: `${(metrics.stanceAsymmetryPct || 0).toFixed(1)}%`,
      normalRange: '<5%',
      clinicalSignificance: this.mapZScoreToSignificance(asymmetryInterpretation.zScore),
      description: asymmetryInterpretation.clinicalSignificance,
      evidenceLevel: 'B'
    });

    // Categorize findings
    const primaryFindings = findings.filter(f => ['moderate', 'severe', 'critical'].includes(f.clinicalSignificance));
    const secondaryFindings = findings.filter(f => f.clinicalSignificance === 'mild');
    const normalFindings = findings.filter(f => f.clinicalSignificance === 'normal');
    const criticalFindings = findings.filter(f => f.clinicalSignificance === 'critical');

    const overallSummary = this.generateOverallSummary(primaryFindings, criticalFindings);

    return {
      primaryFindings,
      secondaryFindings,
      normalFindings,
      criticalFindings,
      overallSummary
    };
  }

  private generateKinematicAnalysis(
    kinematicSummary?: KinematicSummary,
    frontalMetrics?: FrontalMetrics,
    cycleAnalysis?: GaitCycleComparison
  ): KinematicAnalysisSection {

    const sagittalPlane: PlaneAnalysis = {
      findings: kinematicSummary?.deviations.map(dev => ({
        parameter: `${dev.joint} ${dev.side}`,
        value: `${dev.observedValue.toFixed(1)}°`,
        normalRange: `${dev.normalRange.min}-${dev.normalRange.max}°`,
        clinicalSignificance: dev.severity as any,
        description: dev.description,
        evidenceLevel: 'B' as const
      })) || [],
      deviations: kinematicSummary?.deviations.map(dev => dev.description) || [],
      functionalImpact: kinematicSummary ? this.assessKinematicFunctionalImpact(kinematicSummary) : ''
    };

    const frontalPlane: PlaneAnalysis = {
      findings: [],
      deviations: frontalMetrics ? this.generateFrontalDeviations(frontalMetrics) : [],
      functionalImpact: frontalMetrics ? this.assessFrontalFunctionalImpact(frontalMetrics) : ''
    };

    const spatiotemporalParameters: SpatiotemporalAnalysis = {
      walkingSpeed: sagittalPlane.findings.find(f => f.parameter.includes('velocidad')) || {
        parameter: 'Velocidad',
        value: 'N/A',
        normalRange: 'N/A',
        clinicalSignificance: 'normal',
        description: 'No disponible',
        evidenceLevel: 'C'
      },
      cadence: sagittalPlane.findings.find(f => f.parameter.includes('cadencia')) || {
        parameter: 'Cadencia',
        value: 'N/A',
        normalRange: 'N/A',
        clinicalSignificance: 'normal',
        description: 'No disponible',
        evidenceLevel: 'C'
      },
      stepLength: {
        parameter: 'Longitud de paso',
        value: 'N/A',
        normalRange: '0.6-0.8 m',
        clinicalSignificance: 'normal',
        description: 'No disponible',
        evidenceLevel: 'C'
      },
      asymmetryIndex: {
        parameter: 'Índice de asimetría',
        value: 'N/A',
        normalRange: '<5%',
        clinicalSignificance: 'normal',
        description: 'No disponible',
        evidenceLevel: 'C'
      },
      summary: 'Análisis espaciotemporal completado con limitaciones de datos'
    };

    const gaitCycleAnalysis: GaitCycleAnalysisReport = {
      phaseAnalysis: cycleAnalysis ? this.generatePhaseAnalysis(cycleAnalysis) : 'No disponible',
      timingAbnormalities: cycleAnalysis ? this.identifyTimingAbnormalities(cycleAnalysis) : [],
      bilateralComparison: cycleAnalysis ? cycleAnalysis.asymmetryAnalysis.clinicalInterpretation : 'No disponible',
      functionalImplications: cycleAnalysis ? this.assessCycleFunctionalImplications(cycleAnalysis) : 'No disponible'
    };

    return {
      sagittalPlane,
      frontalPlane,
      spatiotemporalParameters,
      gaitCycleAnalysis
    };
  }

  private generateCompensationAnalysis(analysis?: CompensationAnalysis): CompensationAnalysisSection {
    if (!analysis) {
      return {
        primaryCompensations: [],
        secondaryCompensations: [],
        biomechanicalCauses: [],
        functionalImpact: 'No disponible',
        interventionPriorities: []
      };
    }

    return {
      primaryCompensations: analysis.primaryCompensation ? [analysis.primaryCompensation.description] : [],
      secondaryCompensations: analysis.secondaryCompensations.map(comp => comp.description),
      biomechanicalCauses: analysis.primaryCompensation?.biomechanicalCause || [],
      functionalImpact: this.generateFunctionalImpactSummary(analysis.functionalImpact),
      interventionPriorities: analysis.primaryCompensation?.recommendedIntervention || []
    };
  }

  private generateFunctionalAssessment(
    metrics: AdvancedMetrics,
    compensationAnalysis?: CompensationAnalysis
  ): FunctionalAssessment {

    // Determine mobility level
    let mobilityLevel: 'independent' | 'assisted' | 'dependent' = 'independent';
    if (compensationAnalysis && compensationAnalysis.functionalImpact.functionalLevel !== 'independent') {
      mobilityLevel = compensationAnalysis.functionalImpact.functionalLevel;
    }

    // Determine fall risk
    let fallRisk: 'low' | 'moderate' | 'high' | 'very_high' = 'low';
    const speed = metrics.speedMps || 0;
    if (speed < 0.8) fallRisk = 'very_high';
    else if (speed < 1.0) fallRisk = 'high';
    else if (speed < 1.2) fallRisk = 'moderate';

    // Energy efficiency
    let energyEfficiency: 'normal' | 'mildly_reduced' | 'moderately_reduced' | 'severely_reduced' = 'normal';
    if (compensationAnalysis) {
      const energyIncrease = compensationAnalysis.functionalImpact.energyExpenditureIncrease;
      if (energyIncrease > 50) energyEfficiency = 'severely_reduced';
      else if (energyIncrease > 30) energyEfficiency = 'moderately_reduced';
      else if (energyIncrease > 15) energyEfficiency = 'mildly_reduced';
    }

    // Functional score
    const functionalScore = compensationAnalysis?.compensationScore || 100;

    // Community ambulation
    let communityAmbulation: 'unlimited' | 'limited' | 'household_only' | 'non_functional' = 'unlimited';
    if (speed < 0.4) communityAmbulation = 'non_functional';
    else if (speed < 0.8) communityAmbulation = 'household_only';
    else if (speed < 1.0) communityAmbulation = 'limited';

    // Assistive device recommendation
    let assistiveDeviceRecommendation: string | null = null;
    if (fallRisk === 'very_high') {
      assistiveDeviceRecommendation = 'Andador con ruedas o silla de ruedas para distancias largas';
    } else if (fallRisk === 'high') {
      assistiveDeviceRecommendation = 'Bastón o muletas según evaluación fisioterápica';
    }

    return {
      mobilityLevel,
      fallRisk,
      energyEfficiency,
      functionalScore,
      communityAmbulation,
      assistiveDeviceRecommendation
    };
  }

  private generatePathologyAnalysis(
    basicMetrics: AdvancedMetrics,
    gaitCycles?: any[],
    compensationAnalysis?: CompensationAnalysis,
    kinematics?: any
  ): PathologyAnalysis {
    if (!gaitCycles || !compensationAnalysis) {
      return {
        primaryFindings: [],
        differentialDiagnosis: [],
        riskFactors: {
          fallRisk: 0,
          mobilityLevel: 'independent',
          progressionRisk: 0
        },
        interventionPriorities: [],
        monitoringParameters: []
      };
    }

    const compensationPatterns = compensationAnalysis.secondaryCompensations || [];

    return pathologyAnalyzer.analyzePathologyIndicators(
      basicMetrics,
      gaitCycles,
      compensationPatterns,
      kinematics
    );
  }

  private generateOGSAnalysis(ogsAnalysis?: OGSAnalysis): OGSAnalysisSection {
    if (!ogsAnalysis) {
      return {
        leftTotal: null,
        rightTotal: null,
        asymmetryIndex: null,
        qualityIndex: null,
        overallInterpretation: 'Evaluación OGS no realizada',
        specificFindings: [],
        correlationSummary: 'No disponible',
        reliabilityNotes: 'La evaluación OGS no fue completada durante esta sesión',
        clinicalRecommendations: ['Considerar evaluación OGS en futuras sesiones para análisis cualitativo complementario']
      };
    }

    // Generar hallazgos específicos por fase
    const specificFindings: OGSFinding[] = [];
    if (ogsAnalysis.leftScore && ogsAnalysis.rightScore) {
      const phases = [
        { key: 'initialFootContact', label: 'Contacto Inicial' },
        { key: 'loadingResponse', label: 'Respuesta de Carga' },
        { key: 'midStance', label: 'Apoyo Medio' },
        { key: 'terminalStance', label: 'Apoyo Terminal' },
        { key: 'preSwing', label: 'Pre-Balanceo' },
        { key: 'initialSwing', label: 'Balanceo Inicial' },
        { key: 'midSwing', label: 'Balanceo Medio' },
        { key: 'terminalSwing', label: 'Balanceo Terminal' }
      ] as const;

      phases.forEach(phase => {
        const leftScore = ogsAnalysis.leftScore![phase.key as keyof typeof ogsAnalysis.leftScore];
        const rightScore = ogsAnalysis.rightScore![phase.key as keyof typeof ogsAnalysis.rightScore];

        let interpretation = '';
        let significance: 'normal' | 'mild' | 'moderate' | 'severe' = 'normal';

        const avgScore = ((leftScore ?? 0) + (rightScore ?? 0)) / 2;
        if (avgScore >= 2.5) {
          interpretation = 'Patrón normal bilateral';
          significance = 'normal';
        } else if (avgScore >= 1.5) {
          interpretation = 'Alteraciones leves observadas';
          significance = 'mild';
        } else if (avgScore >= 0.5) {
          interpretation = 'Alteraciones moderadas que requieren atención';
          significance = 'moderate';
        } else {
          interpretation = 'Alteraciones severas detectadas';
          significance = 'severe';
        }

        if (leftScore !== null && rightScore !== null && Math.abs(leftScore - rightScore) >= 2) {
          interpretation += ` (asimetría significativa: ${leftScore} vs ${rightScore})`;
        }

        specificFindings.push({
          phase: phase.label,
          leftScore,
          rightScore,
          interpretation,
          clinicalSignificance: significance
        });
      });
    }

    // Interpretación general
    let overallInterpretation = '';
    if (ogsAnalysis.qualityIndex !== null) {
      if (ogsAnalysis.qualityIndex >= 75) {
        overallInterpretation = 'Evaluación OGS indica patrón de marcha dentro de parámetros normales';
      } else if (ogsAnalysis.qualityIndex >= 50) {
        overallInterpretation = 'Evaluación OGS muestra alteraciones moderadas del patrón de marcha';
      } else if (ogsAnalysis.qualityIndex >= 25) {
        overallInterpretation = 'Evaluación OGS revela alteraciones significativas que requieren intervención';
      } else {
        overallInterpretation = 'Evaluación OGS indica alteraciones severas con impacto funcional considerable';
      }

      if (ogsAnalysis.asymmetryIndex !== null && ogsAnalysis.asymmetryIndex > 25) {
        overallInterpretation += `. Asimetría bilateral marcada (${ogsAnalysis.asymmetryIndex.toFixed(1)}%)`;
      }
    }

    // Resumen de correlaciones
    let correlationSummary = 'No se identificaron correlaciones con datos instrumentales';
    if (ogsAnalysis.correlationWithKinematics.length > 0) {
      const highSigCorrelations = ogsAnalysis.correlationWithKinematics.filter(c => c.significance === 'high');
      if (highSigCorrelations.length > 0) {
        correlationSummary = `Se identificaron ${highSigCorrelations.length} correlaciones significativas entre evaluación OGS y análisis instrumental`;
      } else {
        correlationSummary = `Se identificaron ${ogsAnalysis.correlationWithKinematics.length} correlaciones de significancia variable con análisis instrumental`;
      }
    }

    // Notas de fiabilidad
    const reliabilityNotes = 'La evaluación OGS presenta mayor fiabilidad para articulaciones distales (rodilla y tobillo). Las mediciones de cadera y pelvis deben interpretarse con precaución. La evaluación es observador-dependiente y se recomienda entrenamiento específico.';

    return {
      leftTotal: ogsAnalysis.leftTotal,
      rightTotal: ogsAnalysis.rightTotal,
      asymmetryIndex: ogsAnalysis.asymmetryIndex,
      qualityIndex: ogsAnalysis.qualityIndex,
      overallInterpretation,
      specificFindings,
      correlationSummary,
      reliabilityNotes,
      clinicalRecommendations: ogsAnalysis.recommendations
    };
  }

  private generateClinicalImpression(
    findings: ClinicalFindings,
    compensationAnalysis?: CompensationAnalysis,
    pathologyAnalysis?: PathologyAnalysis,
    ogsAnalysis?: OGSAnalysis
  ): ClinicalImpression {

    // Primary diagnosis based on findings, pathology analysis, and OGS
    let primaryDiagnosis = 'Patrón de marcha dentro de límites normales';

    if (pathologyAnalysis && pathologyAnalysis.primaryFindings.length > 0) {
      const topFinding = pathologyAnalysis.primaryFindings[0];
      primaryDiagnosis = `Patrón compatible con ${topFinding.condition} (confianza: ${(topFinding.confidence * 100).toFixed(0)}%)`;
    } else if (ogsAnalysis && ogsAnalysis.qualityIndex !== null && ogsAnalysis.qualityIndex < 50) {
      primaryDiagnosis = `Alteración del patrón de marcha según evaluación observacional (OGS: ${ogsAnalysis.qualityIndex.toFixed(0)}%)`;
    } else if (findings.criticalFindings.length > 0) {
      primaryDiagnosis = 'Alteración significativa del patrón de marcha';
    } else if (findings.primaryFindings.length > 0) {
      primaryDiagnosis = 'Alteración moderada del patrón de marcha';
    } else if (findings.secondaryFindings.length > 0) {
      primaryDiagnosis = 'Alteración leve del patrón de marcha';
    }

    // Differential diagnosis from pathology analysis and compensations
    const differentialDiagnosis: string[] = [];

    if (pathologyAnalysis && pathologyAnalysis.differentialDiagnosis.length > 0) {
      pathologyAnalysis.differentialDiagnosis.forEach(diagnosis => {
        differentialDiagnosis.push(`${diagnosis.condition} (${(diagnosis.confidence * 100).toFixed(0)}%)`);
      });
    }

    if (compensationAnalysis?.primaryCompensation) {
      const comp = compensationAnalysis.primaryCompensation;
      switch (comp.type) {
        case 'antalgic':
          differentialDiagnosis.push('Dolor musculoesquelético', 'Artritis', 'Lesión traumática');
          break;
        case 'trendelenburg':
          differentialDiagnosis.push('Debilidad de abductores', 'Displasia de cadera', 'Neuropatía');
          break;
        case 'steppage':
          differentialDiagnosis.push('Foot drop', 'Parálisis del nervio peroneo', 'Miopatía distal');
          break;
        case 'crouch_gait':
          differentialDiagnosis.push('Parálisis cerebral', 'Miopatía', 'Contracturas articulares');
          break;
        default:
          differentialDiagnosis.push('Alteración neuromuscular', 'Disfunción biomecánica');
      }
    }

    // Severity
    let severity: 'mild' | 'moderate' | 'severe' = 'mild';
    if (findings.criticalFindings.length > 0) severity = 'severe';
    else if (findings.primaryFindings.length > 1) severity = 'moderate';

    // Prognosis
    let prognosis: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    if (compensationAnalysis) {
      if (compensationAnalysis.overallSeverity === 'severe') prognosis = 'fair';
      if (compensationAnalysis.functionalImpact.functionalLevel === 'dependent') prognosis = 'poor';
    }

    // Key points
    const keyPoints: string[] = [];
    if (findings.primaryFindings.length > 0) {
      keyPoints.push(`${findings.primaryFindings.length} hallazgos clínicos principales identificados`);
    }
    if (compensationAnalysis?.primaryCompensation) {
      keyPoints.push(`Compensación principal: ${compensationAnalysis.primaryCompensation.type}`);
    }
    keyPoints.push(`Nivel funcional: ${compensationAnalysis?.functionalImpact.functionalLevel || 'independiente'}`);

    const clinicalCorrelation = 'Los hallazgos del análisis de marcha deben correlacionarse con la evaluación clínica completa del paciente';

    return {
      primaryDiagnosis,
      differentialDiagnosis,
      severity,
      prognosis,
      keyPoints,
      clinicalCorrelation
    };
  }

  private generateRecommendations(
    impression: ClinicalImpression,
    functional: FunctionalAssessment,
    compensationAnalysis?: CompensationAnalysis,
    pathologyAnalysis?: PathologyAnalysis,
    ogsAnalysis?: OGSAnalysis
  ): Recommendations {

    const immediate: RecommendationItem[] = [];
    const shortTerm: RecommendationItem[] = [];
    const longTerm: RecommendationItem[] = [];

    // Immediate recommendations
    if (functional.fallRisk === 'very_high') {
      immediate.push({
        category: 'medical',
        intervention: 'Evaluación médica urgente',
        rationale: 'Riesgo muy alto de caídas identificado',
        expectedOutcome: 'Identificación de causas tratables',
        timeframe: '1-2 semanas',
        provider: 'Médico especialista'
      });
    }

    if (functional.assistiveDeviceRecommendation) {
      immediate.push({
        category: 'assistive_device',
        intervention: functional.assistiveDeviceRecommendation,
        rationale: 'Mejorar seguridad y funcionalidad',
        expectedOutcome: 'Reducción del riesgo de caídas',
        timeframe: 'Inmediato',
        provider: 'Fisioterapeuta/Terapeuta ocupacional'
      });
    }

    // Pathology-specific recommendations
    if (pathologyAnalysis && pathologyAnalysis.primaryFindings.length > 0) {
      pathologyAnalysis.primaryFindings.forEach(finding => {
        finding.recommendations.forEach(rec => {
          if (finding.severity === 'severe') {
            immediate.push({
              category: 'medical',
              intervention: rec,
              rationale: `Manejo de ${finding.condition}`,
              expectedOutcome: 'Estabilización clínica',
              timeframe: 'Inmediato',
              provider: 'Especialista'
            });
          } else {
            shortTerm.push({
              category: 'therapy',
              intervention: rec,
              rationale: `Tratamiento de ${finding.condition}`,
              expectedOutcome: 'Mejora funcional',
              timeframe: '2-8 semanas',
              provider: 'Equipo multidisciplinario'
            });
          }
        });
      });
    }

    // Short-term recommendations
    if (compensationAnalysis?.primaryCompensation) {
      compensationAnalysis.primaryCompensation.recommendedIntervention.forEach(intervention => {
        shortTerm.push({
          category: 'therapy',
          intervention,
          rationale: 'Abordar compensación primaria',
          expectedOutcome: 'Mejora del patrón de marcha',
          timeframe: '4-8 semanas',
          provider: 'Fisioterapeuta'
        });
      });
    }

    // OGS-specific recommendations
    if (ogsAnalysis && ogsAnalysis.recommendations.length > 0) {
      ogsAnalysis.recommendations.forEach(rec => {
        if (rec.includes('urgente') || rec.includes('inmediata')) {
          immediate.push({
            category: 'medical',
            intervention: rec,
            rationale: 'Basado en evaluación observacional OGS',
            expectedOutcome: 'Mejora del patrón observacional',
            timeframe: 'Inmediato',
            provider: 'Especialista en marcha'
          });
        } else if (rec.includes('seguimiento') || rec.includes('reevaluación')) {
          longTerm.push({
            category: 'monitoring',
            intervention: rec,
            rationale: 'Monitoreo observacional sistemático',
            expectedOutcome: 'Documentación objetiva del progreso',
            timeframe: '4-8 semanas',
            provider: 'Fisioterapeuta entrenado en OGS'
          });
        } else {
          shortTerm.push({
            category: 'therapy',
            intervention: rec,
            rationale: 'Intervención dirigida según hallazgos OGS',
            expectedOutcome: 'Mejora en puntuación observacional',
            timeframe: '2-6 semanas',
            provider: 'Fisioterapeuta especializado'
          });
        }
      });
    }

    // Long-term recommendations
    longTerm.push({
      category: 'monitoring',
      intervention: 'Seguimiento del análisis de marcha',
      rationale: 'Monitorear progreso y cambios',
      expectedOutcome: 'Optimización del tratamiento',
      timeframe: '3-6 meses',
      provider: 'Equipo multidisciplinario'
    });

    let priority: 'urgent' | 'high' | 'medium' | 'low' = 'medium';
    if (impression.severity === 'severe') priority = 'urgent';
    else if (impression.severity === 'moderate') priority = 'high';

    return {
      immediate,
      shortTerm,
      longTerm,
      priority
    };
  }

  private generateFollowUpPlan(
    impression: ClinicalImpression,
    _recommendations: Recommendations
  ): FollowUpPlan {

    let nextAssessment = '6 meses';
    if (impression.severity === 'severe') nextAssessment = '4-6 semanas';
    else if (impression.severity === 'moderate') nextAssessment = '3 meses';

    const monitoringParameters = [
      'Velocidad de marcha',
      'Índice de asimetría',
      'Compensaciones principales',
      'Nivel funcional'
    ];

    const outcomeMetrics = [
      'Mejora de la velocidad >0.1 m/s',
      'Reducción de asimetría <5%',
      'Mejora del score funcional >10 puntos',
      'Reducción del riesgo de caídas'
    ];

    const progressIndicators = [
      'Aumento de la distancia de caminata',
      'Mejora de la confianza en la marcha',
      'Reducción de compensaciones',
      'Mejora de la calidad de vida'
    ];

    const alertCriteria = [
      'Deterioro de velocidad >20%',
      'Aparición de nuevas compensaciones',
      'Aumento del riesgo de caídas',
      'Reducción del nivel funcional'
    ];

    return {
      nextAssessment,
      monitoringParameters,
      outcomeMetrics,
      progressIndicators,
      alertCriteria
    };
  }

  private generateReferences(): string[] {
    return [
      'Perry J, Burnfield JM. Gait Analysis: Normal and Pathological Function. 2nd ed. Thorofare, NJ: SLACK; 2010.',
      'Bohannon RW, Andrews AW. Normal walking speed: a descriptive meta-analysis. Physiotherapy. 2011;97(3):182-189.',
      'Plotnik M, Giladi N, Hausdorff JM. A new measure for quantifying the bilateral coordination of human gait. Exp Brain Res. 2007;181(4):561-570.',
      'Studenski S, et al. Gait speed and survival in older adults. JAMA. 2011;305(1):50-58.',
      'Rodda JM, et al. Classification of gait patterns in spastic hemiplegia and spastic diplegia: a basis for a management algorithm. Eur J Neurol. 2001;8 Suppl 5:98-108.'
    ];
  }

  // Helper methods
  private mapZScoreToSignificance(zScore: number): 'normal' | 'mild' | 'moderate' | 'severe' | 'critical' {
    if (Math.abs(zScore) < 1) return 'normal';
    if (Math.abs(zScore) < 2) return 'mild';
    if (Math.abs(zScore) < 3) return 'moderate';
    if (Math.abs(zScore) < 4) return 'severe';
    return 'critical';
  }

  private generateOverallSummary(primary: Finding[], critical: Finding[]): string {
    if (critical.length > 0) {
      return `Se identificaron ${critical.length} hallazgos críticos que requieren atención médica inmediata.`;
    }
    if (primary.length > 0) {
      return `Se identificaron ${primary.length} hallazgos principales que requieren evaluación clínica.`;
    }
    return 'Los parámetros analizados se encuentran dentro de rangos normales.';
  }

  private assessKinematicFunctionalImpact(summary: KinematicSummary): string {
    if (summary.kinematicQualityScore >= 80) {
      return 'Patrón cinemático eficiente con mínimo impacto funcional.';
    } else if (summary.kinematicQualityScore >= 60) {
      return 'Alteraciones cinemáticas moderadas con impacto funcional leve a moderado.';
    } else {
      return 'Alteraciones cinemáticas significativas con impacto funcional considerable.';
    }
  }

  private generateFrontalDeviations(metrics: FrontalMetrics): string[] {
    const deviations: string[] = [];

    if (metrics.excessiveTrunkSway) {
      deviations.push('Balanceo excesivo del tronco en plano frontal');
    }
    if (metrics.hipHiking) {
      deviations.push('Elevación compensatoria de cadera');
    }
    if (metrics.circumduction) {
      deviations.push('Patrón de circunducción durante el balanceo');
    }

    return deviations;
  }

  private assessFrontalFunctionalImpact(metrics: FrontalMetrics): string {
    if (metrics.compensationScore && metrics.compensationScore >= 80) {
      return 'Patrón frontal eficiente con estabilidad lateral adecuada.';
    } else {
      return 'Compensaciones frontales que impactan la eficiencia energética y estabilidad.';
    }
  }

  private generatePhaseAnalysis(cycle: GaitCycleComparison): string {
    return `Análisis de fases: Fase de apoyo izquierda ${cycle.leftCycle.stancePhasePercent.toFixed(1)}%, derecha ${cycle.rightCycle.stancePhasePercent.toFixed(1)}%. ${cycle.asymmetryAnalysis.clinicalInterpretation}`;
  }

  private identifyTimingAbnormalities(cycle: GaitCycleComparison): string[] {
    const abnormalities: string[] = [];

    if (cycle.asymmetryAnalysis.overallAsymmetryIndex > 10) {
      abnormalities.push(`Asimetría temporal significativa (${cycle.asymmetryAnalysis.overallAsymmetryIndex.toFixed(1)}%)`);
    }

    return abnormalities;
  }

  private assessCycleFunctionalImplications(cycle: GaitCycleComparison): string {
    if (cycle.asymmetryAnalysis.overallAsymmetryIndex < 5) {
      return 'Patrón cíclico simétrico con implicaciones funcionales mínimas.';
    } else {
      return 'Asimetría cíclica que puede impactar la eficiencia energética y aumentar el riesgo de sobrecarga.';
    }
  }

  private generateFunctionalImpactSummary(impact: { energyExpenditureIncrease: number; mobilityReduction: number; functionalLevel: string }): string {
    return `Aumento del gasto energético: ${impact.energyExpenditureIncrease.toFixed(0)}%. Reducción de movilidad: ${impact.mobilityReduction.toFixed(0)}%. Nivel funcional: ${impact.functionalLevel}.`;
  }

  public generateFormattedReport(report: MedicalReport): string {
    let formatted = '';

    // Header
    formatted += '# INFORME DE ANÁLISIS DE MARCHA\n\n';
    formatted += '## Información del Paciente\n';
    formatted += `**ID:** ${report.header.patientInfo.identifier}\n`;
    if (report.header.patientInfo.age) formatted += `**Edad:** ${report.header.patientInfo.age} años\n`;
    if (report.header.patientInfo.gender) formatted += `**Sexo:** ${report.header.patientInfo.gender}\n`;
    formatted += `**Fecha de evaluación:** ${report.header.assessmentInfo.date}\n\n`;

    // Clinical findings
    formatted += '## Hallazgos Clínicos\n';
    formatted += `${report.clinicalFindings.overallSummary}\n\n`;

    if (report.clinicalFindings.primaryFindings.length > 0) {
      formatted += '### Hallazgos Principales\n';
      report.clinicalFindings.primaryFindings.forEach(finding => {
        formatted += `- **${finding.parameter}:** ${finding.value} (${finding.description})\n`;
      });
      formatted += '\n';
    }

    // Pathology analysis
    if (report.pathologyAnalysis.primaryFindings.length > 0) {
      formatted += '### Análisis de Patologías\n';
      report.pathologyAnalysis.primaryFindings.forEach(finding => {
        formatted += `- **${finding.condition}:** ${(finding.confidence * 100).toFixed(0)}% confianza (${finding.severity})\n`;
        if (finding.evidence.length > 0) {
          formatted += `  - Evidencia: ${finding.evidence.join(', ')}\n`;
        }
      });
      formatted += '\n';
    }

    // OGS Analysis
    if (report.ogsAnalysis.leftTotal !== null && report.ogsAnalysis.rightTotal !== null) {
      formatted += '### Escala de Marcha Observacional (OGS)\n';
      formatted += `**Puntuación Total:** Izquierda ${report.ogsAnalysis.leftTotal}/24, Derecha ${report.ogsAnalysis.rightTotal}/24\n`;
      if (report.ogsAnalysis.qualityIndex !== null) {
        formatted += `**Índice de Calidad:** ${report.ogsAnalysis.qualityIndex.toFixed(1)}%\n`;
      }
      if (report.ogsAnalysis.asymmetryIndex !== null) {
        formatted += `**Asimetría:** ${report.ogsAnalysis.asymmetryIndex.toFixed(1)}%\n`;
      }
      formatted += `**Interpretación:** ${report.ogsAnalysis.overallInterpretation}\n`;

      if (report.ogsAnalysis.specificFindings.length > 0) {
        const severeFindings = report.ogsAnalysis.specificFindings.filter(f => f.clinicalSignificance === 'severe');
        if (severeFindings.length > 0) {
          formatted += `**Hallazgos Críticos:** ${severeFindings.map(f => f.phase).join(', ')}\n`;
        }
      }
      formatted += '\n';
    }

    // Functional assessment
    formatted += '## Evaluación Funcional\n';
    formatted += `**Nivel de movilidad:** ${report.functionalAssessment.mobilityLevel}\n`;
    formatted += `**Riesgo de caídas:** ${report.functionalAssessment.fallRisk}\n`;
    formatted += `**Puntuación funcional:** ${report.functionalAssessment.functionalScore}/100\n\n`;

    // Clinical impression
    formatted += '## Impresión Clínica\n';
    formatted += `**Diagnóstico principal:** ${report.clinicalImpression.primaryDiagnosis}\n`;
    formatted += `**Severidad:** ${report.clinicalImpression.severity}\n`;
    formatted += `**Pronóstico:** ${report.clinicalImpression.prognosis}\n\n`;

    // Recommendations
    formatted += '## Recomendaciones\n';
    if (report.recommendations.immediate.length > 0) {
      formatted += '### Inmediatas\n';
      report.recommendations.immediate.forEach(rec => {
        formatted += `- ${rec.intervention} (${rec.timeframe})\n`;
      });
      formatted += '\n';
    }

    if (report.recommendations.shortTerm.length > 0) {
      formatted += '### Corto plazo\n';
      report.recommendations.shortTerm.forEach(rec => {
        formatted += `- ${rec.intervention} (${rec.timeframe})\n`;
      });
      formatted += '\n';
    }

    // Follow-up
    formatted += '## Plan de Seguimiento\n';
    formatted += `**Próxima evaluación:** ${report.followUp.nextAssessment}\n`;
    formatted += `**Parámetros a monitorizar:** ${report.followUp.monitoringParameters.join(', ')}\n\n`;

    // References
    formatted += '## Referencias\n';
    report.references.forEach(ref => {
      formatted += `- ${ref}\n`;
    });

    return formatted;
  }
}