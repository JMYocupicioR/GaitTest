import { useState, useEffect } from 'react';
import type { OGSAnalysis, AdvancedMetrics } from '../types/session.ts';
import type { KinematicSummary } from '../types/session.ts';
import type { CompensationAnalysis } from '../lib/compensationDetection.ts';
import { ogsAnalyzer } from '../lib/ogsAnalysis.ts';

interface OGSValidationPanelProps {
  ogsAnalysis: OGSAnalysis;
  advancedMetrics?: AdvancedMetrics;
  kinematics?: KinematicSummary;
  compensations?: CompensationAnalysis;
  onValidationComplete?: (validationResults: ValidationResults) => void;
}

interface ValidationResults {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
  correlationScore: number;
  reliabilityScore: number;
}

export const OGSValidationPanel = ({
  ogsAnalysis,
  advancedMetrics,
  kinematics,
  compensations,
  onValidationComplete
}: OGSValidationPanelProps) => {
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const performValidation = () => {
    if (!ogsAnalysis.leftScore || !ogsAnalysis.rightScore) return;

    // Validación básica de puntuaciones OGS
    const basicValidation = ogsAnalyzer.validateOGSScores(
      ogsAnalysis.leftScore,
      ogsAnalysis.rightScore
    );

    // Calcular puntuación de correlación
    const correlationScore = calculateCorrelationScore();

    // Calcular puntuación de fiabilidad
    const reliabilityScore = calculateReliabilityScore();

    const results: ValidationResults = {
      isValid: basicValidation.isValid,
      warnings: basicValidation.warnings,
      suggestions: [...basicValidation.suggestions, ...generateEnhancedSuggestions()],
      correlationScore,
      reliabilityScore
    };

    setValidationResults(results);
    onValidationComplete?.(results);
  };

  useEffect(() => {
    if (ogsAnalysis.leftScore && ogsAnalysis.rightScore) {
      performValidation();
    }
  }, [ogsAnalysis, advancedMetrics, kinematics, compensations, performValidation]);

  const calculateCorrelationScore = (): number => {
    if (!advancedMetrics && !kinematics && !compensations) return 0;

    let correlationPoints = 0;
    let totalChecks = 0;

    // Correlación con métricas avanzadas
    if (advancedMetrics && ogsAnalysis.leftTotal !== null && ogsAnalysis.rightTotal !== null) {
      totalChecks += 3;

      // Velocidad vs puntuación OGS
      const avgOGS = (ogsAnalysis.leftTotal + ogsAnalysis.rightTotal) / 2;
      if (advancedMetrics.speedMps) {
        const expectedSpeed = avgOGS > 18 ? 1.0 : avgOGS > 12 ? 0.8 : 0.6;
        const speedDiff = Math.abs(advancedMetrics.speedMps - expectedSpeed);
        if (speedDiff < 0.3) correlationPoints += 1;
      }

      // Asimetría temporal vs asimetría OGS
      if (advancedMetrics.stanceAsymmetryPct && ogsAnalysis.asymmetryIndex !== null) {
        const ogsAsymmetry = ogsAnalysis.asymmetryIndex;
        const expectedTemporalAsymmetry = ogsAsymmetry > 25 ? 15 : ogsAsymmetry > 10 ? 8 : 3;
        const asymmetryDiff = Math.abs(advancedMetrics.stanceAsymmetryPct - expectedTemporalAsymmetry);
        if (asymmetryDiff < 10) correlationPoints += 1;
      }

      // Ángulos articulares vs puntuaciones específicas
      if (advancedMetrics.leftKneeAngle && advancedMetrics.rightKneeAngle) {
        const leftKneeOGS = (ogsAnalysis.leftScore!.midStance ?? 0) + (ogsAnalysis.leftScore!.terminalStance ?? 0);
        const rightKneeOGS = (ogsAnalysis.rightScore!.midStance ?? 0) + (ogsAnalysis.rightScore!.terminalStance ?? 0);

        const expectedLeftKnee = leftKneeOGS > 4 ? 50 : leftKneeOGS > 2 ? 35 : 25;
        const expectedRightKnee = rightKneeOGS > 4 ? 50 : rightKneeOGS > 2 ? 35 : 25;

        const leftDiff = Math.abs(advancedMetrics.leftKneeAngle - expectedLeftKnee);
        const rightDiff = Math.abs(advancedMetrics.rightKneeAngle - expectedRightKnee);

        if (leftDiff < 15 && rightDiff < 15) correlationPoints += 1;
      }
    }

    // Correlación con compensaciones
    if (compensations) {
      totalChecks += 2;

      if (compensations.primaryCompensation) {
        const comp = compensations.primaryCompensation;
        let expectedOGSReduction = false;

        // Mapear compensaciones a expectativas OGS
        if (comp.type.includes('trendelenburg') && ogsAnalysis.leftTotal! + ogsAnalysis.rightTotal! < 30) {
          expectedOGSReduction = true;
        }
        if (comp.type.includes('circumduction') && ogsAnalysis.leftTotal! + ogsAnalysis.rightTotal! < 35) {
          expectedOGSReduction = true;
        }
        if (comp.type.includes('antalgic') && ogsAnalysis.asymmetryIndex! > 20) {
          expectedOGSReduction = true;
        }

        if (expectedOGSReduction) correlationPoints += 1;
      }

      // Número de compensaciones vs puntuación OGS
      const numCompensations = compensations.secondaryCompensations?.length || 0;
      const avgOGS = (ogsAnalysis.leftTotal! + ogsAnalysis.rightTotal!) / 2;
      const expectedCompensations = avgOGS > 18 ? 1 : avgOGS > 12 ? 3 : 5;

      if (Math.abs(numCompensations - expectedCompensations) <= 2) {
        correlationPoints += 1;
      }
    }

    return totalChecks > 0 ? (correlationPoints / totalChecks) * 100 : 0;
  };

  const calculateReliabilityScore = (): number => {
    if (!ogsAnalysis.leftScore || !ogsAnalysis.rightScore) return 0;

    let reliabilityPoints = 0;
    const totalItems = 8;

    // Puntos por completitud
    const leftComplete = Object.values(ogsAnalysis.leftScore).filter(score => score !== null).length;
    const rightComplete = Object.values(ogsAnalysis.rightScore).filter(score => score !== null).length;
    const completeness = (leftComplete + rightComplete) / (totalItems * 2);
    reliabilityPoints += completeness * 40; // 40% por completitud

    // Puntos por consistencia (ítems distales más confiables)
    const distalItems: (keyof typeof ogsAnalysis.leftScore)[] = ['midStance', 'terminalStance', 'initialFootContact', 'loadingResponse'];
    let distalConsistency = 0;

    distalItems.forEach(item => {
      const leftScore = ogsAnalysis.leftScore![item];
      const rightScore = ogsAnalysis.rightScore![item];

      if (leftScore !== null && rightScore !== null) {
        // Menor variabilidad indica mayor consistencia/fiabilidad
        const difference = Math.abs(leftScore - rightScore);
        if (difference <= 1) distalConsistency += 1; // Diferencia aceptable
      }
    });

    reliabilityPoints += (distalConsistency / distalItems.length) * 30; // 30% por consistencia distal

    // Puntos por patrones lógicos
    let logicalPatterns = 0;

    // Verificar que el patrón de swing sea consistente con stance
    const leftStanceAvg = ((ogsAnalysis.leftScore.midStance ?? 0) + (ogsAnalysis.leftScore.terminalStance ?? 0)) / 2;
    const leftSwingAvg = ((ogsAnalysis.leftScore.initialSwing ?? 0) + (ogsAnalysis.leftScore.midSwing ?? 0)) / 2;

    if (Math.abs(leftStanceAvg - leftSwingAvg) <= 1.5) logicalPatterns += 1;

    const rightStanceAvg = ((ogsAnalysis.rightScore.midStance ?? 0) + (ogsAnalysis.rightScore.terminalStance ?? 0)) / 2;
    const rightSwingAvg = ((ogsAnalysis.rightScore.initialSwing ?? 0) + (ogsAnalysis.rightScore.midSwing ?? 0)) / 2;

    if (Math.abs(rightStanceAvg - rightSwingAvg) <= 1.5) logicalPatterns += 1;

    reliabilityPoints += (logicalPatterns / 2) * 30; // 30% por patrones lógicos

    return Math.min(100, reliabilityPoints);
  };

  const generateEnhancedSuggestions = (): string[] => {
    const suggestions: string[] = [];

    if (validationResults?.correlationScore !== undefined && validationResults.correlationScore < 50) {
      suggestions.push('Baja correlación con datos instrumentales - revisar puntuaciones en fases de apoyo');
    }

    if (validationResults?.reliabilityScore !== undefined && validationResults.reliabilityScore < 70) {
      suggestions.push('Fiabilidad subóptima - enfocar evaluación en articulaciones distales (rodilla/tobillo)');
    }

    if (ogsAnalysis.correlationWithKinematics.length === 0) {
      suggestions.push('Sin correlaciones identificadas - considerar reevaluación con mayor atención al detalle');
    }

    return suggestions;
  };

  const getValidationColor = (score: number): string => {
    if (score >= 80) return '#16a34a'; // green-600
    if (score >= 60) return '#eab308'; // yellow-500
    if (score >= 40) return '#ea580c'; // orange-600
    return '#dc2626'; // red-600
  };

  if (!validationResults) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          <div style={{ fontSize: '1rem', fontWeight: '500' }}>Validando evaluación OGS...</div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Analizando correlaciones con datos instrumentales
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Validación OGS</h3>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowDetails(!showDetails)}
          style={{ fontSize: '0.9rem' }}
        >
          {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
      </div>

      {/* Indicadores principales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: validationResults.isValid ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${validationResults.isValid ? '#bbf7d0' : '#fecaca'}`,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Estado</div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 'bold',
            color: validationResults.isValid ? '#15803d' : '#dc2626'
          }}>
            {validationResults.isValid ? 'Válido' : 'Advertencias'}
          </div>
        </div>

        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Correlación</div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 'bold',
            color: getValidationColor(validationResults.correlationScore)
          }}>
            {validationResults.correlationScore.toFixed(0)}%
          </div>
        </div>

        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Fiabilidad</div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 'bold',
            color: getValidationColor(validationResults.reliabilityScore)
          }}>
            {validationResults.reliabilityScore.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Advertencias y sugerencias */}
      {(validationResults.warnings.length > 0 || validationResults.suggestions.length > 0) && (
        <div style={{ marginBottom: '1rem' }}>
          {validationResults.warnings.length > 0 && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              marginBottom: '0.5rem'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#92400e', marginBottom: '0.5rem' }}>
                Advertencias:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#92400e' }}>
                {validationResults.warnings.map((warning, index) => (
                  <li key={index} style={{ fontSize: '0.85rem' }}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResults.suggestions.length > 0 && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #3b82f6',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
                Sugerencias:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#1e40af' }}>
                {validationResults.suggestions.map((suggestion, index) => (
                  <li key={index} style={{ fontSize: '0.85rem' }}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Detalles de correlación */}
      {showDetails && ogsAnalysis.correlationWithKinematics.length > 0 && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
            Correlaciones Identificadas:
          </div>
          {ogsAnalysis.correlationWithKinematics.map((correlation, index) => (
            <div key={index} style={{
              fontSize: '0.8rem',
              marginBottom: '0.25rem',
              padding: '0.5rem',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontWeight: '500', color: '#374151' }}>
                {correlation.parameter} ({correlation.foot === 'L' ? 'Izq' : 'Der'})
              </div>
              <div style={{ color: '#6b7280', marginTop: '0.25rem' }}>
                {correlation.description}
              </div>
              <div style={{
                fontSize: '0.7rem',
                marginTop: '0.25rem',
                color: correlation.significance === 'high' ? '#16a34a' : correlation.significance === 'medium' ? '#eab308' : '#6b7280'
              }}>
                Significancia: {correlation.significance}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};