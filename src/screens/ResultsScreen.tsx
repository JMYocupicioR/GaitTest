import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';
import { formatCadence, formatMeters, formatMetersPerSecond, formatPercentage, formatSeconds } from '../lib/format.ts';
import { OGSValidationPanel } from '../components/OGSValidationPanel.tsx';

export const ResultsScreen = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);

  const quality = session.quality;

  return (
    <div className="page">
      <span className="step-indicator">Paso 5 · Resultados</span>
      <header className="page-header">
        <h1>Métricas del clip</h1>
        <p>Interpretación automáticamente generada. Usa estos datos para orientar la valoración clínica.</p>
      </header>

      <section className="card">
        <h2>Métricas temporoespaciales</h2>
        <div className="metric-grid">
          <div className="metric-card card">
            <h3>Velocidad</h3>
            <p>{formatMetersPerSecond(session.metrics.speedMps)}</p>
            <span>Referencia general: 1.0 – 1.4 m/s</span>
          </div>
          <div className="metric-card card">
            <h3>Cadencia</h3>
            <p>{formatCadence(session.metrics.cadenceSpm)}</p>
            <span>Adultos: 95 – 120 pasos/min</span>
          </div>
          <div className="metric-card card">
            <h3>Longitud de paso</h3>
            <p>{formatMeters(session.metrics.stepLengthMeters)}</p>
            <span>Calculada desde la velocidad estimada</span>
          </div>
          <div className="metric-card card">
            <h3>Asimetría apoyo</h3>
            <p>{formatPercentage(session.metrics.stanceAsymmetryPct)}</p>
            <span>Aviso si supera el 10 – 15%</span>
          </div>
        </div>
      </section>

      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Calidad del clip</h2>
        <div>
          <span className={`badge ${quality.confidence}`}>Confianza {quality.confidence}</span>
        </div>
        <p className="helper-text">Duración: {formatSeconds(quality.durationSeconds)} · FPS: {quality.fpsDetected?.toFixed?.(0) ?? '—'}</p>
        {quality.issues.length > 0 ? (
          <ul>
            {quality.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">Calidad adecuada para usar las métricas con confianza moderada.</p>
        )}
      </section>

      <section className="card">
        <h2>Patrones sugeridos</h2>
        <div className="pattern-list">
          {session.patternFlags.map((flag) => (
            <div key={flag.id} className="pattern-item" data-status={flag.status}>
              <strong>{flag.label}</strong>
              <span>{flag.rationale}</span>
              <span className="helper-text">Estado: {flag.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Semáforo</h2>
        <span className={`badge ${session.report.trafficLight}`.trim()}>
          Riesgo {session.report.trafficLight.toUpperCase()}
        </span>
        <p>{session.report.notes || 'Sin notas adicionales.'}</p>
      </section>

      {/* Panel de validación OGS si está disponible */}
      {session.ogs && session.ogs.leftScore && session.ogs.rightScore && (
        <OGSValidationPanel
          ogsAnalysis={session.ogs}
          advancedMetrics={session.advancedMetrics}
          kinematics={session.enhancedAnalysisResult?.kinematicSummary}
          compensations={session.enhancedAnalysisResult?.compensationAnalysis}
        />
      )}

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => navigate('/events')}>
          Ajustar anotaciones
        </button>
        <button type="button" className="primary-button" onClick={() => navigate('/report')}>
          Generar informe
        </button>
      </div>
    </div>
  );
};
