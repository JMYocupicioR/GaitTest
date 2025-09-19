import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLongitudinalAnalysis } from '../hooks/useLongitudinalAnalysis.ts';
import type { TrendAnalysis, AlertMessage } from '../lib/longitudinalAnalysis.ts';

export const LongitudinalScreen = () => {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState('default_patient');

  const {
    sessions,
    report,
    trends,
    isLoading,
    error,
    loadSessions,
    hasEnoughDataForTrends,
    exportLongitudinalData
  } = useLongitudinalAnalysis({
    patientId,
    autoLoad: true
  });

  useEffect(() => {
    if (patientId) {
      loadSessions(patientId);
    }
  }, [patientId, loadSessions]);

  const getTrendColor = (trend: TrendAnalysis['trend']) => {
    switch (trend) {
      case 'improving': return '#059669';
      case 'declining': return '#dc2626';
      case 'stable': return '#6b7280';
      case 'insufficient_data': return '#9ca3af';
      default: return '#6b7280';
    }
  };

  const getAlertColor = (type: AlertMessage['type']) => {
    switch (type) {
      case 'critical': return '#dc2626';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Cargando análisis longitudinal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626' }}>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="primary-button">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <span className="step-indicator">Análisis · Longitudinal</span>
      <header className="page-header">
        <h1>Análisis Longitudinal</h1>
        <p>Seguimiento y tendencias de la marcha a lo largo del tiempo</p>
      </header>

      {/* Patient Selection */}
      <section className="card">
        <h2>Paciente</h2>
        <div className="form-section">
          <label>ID del Paciente</label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Identificador del paciente"
          />
        </div>
      </section>

      {/* Sessions Overview */}
      <section className="card">
        <h2>Resumen de Sesiones</h2>
        {sessions.length === 0 ? (
          <p>No hay sesiones registradas para este paciente.</p>
        ) : (
          <div>
            <p><strong>Total de sesiones:</strong> {sessions.length}</p>
            {report && (
              <>
                <p><strong>Período de análisis:</strong> {report.timeSpanDays} días</p>
                <p><strong>Tendencia general:</strong>
                  <span style={{
                    color: getTrendColor(report.overallTrend),
                    fontWeight: 'bold',
                    marginLeft: '0.5rem'
                  }}>
                    {report.overallTrend === 'improving' ? 'Mejorando' :
                     report.overallTrend === 'declining' ? 'Empeorando' : 'Estable'}
                  </span>
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {/* Alerts */}
      {report && report.alerts && report.alerts.length > 0 && (
        <section className="card">
          <h2>Alertas</h2>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {report.alerts.map((alert, index) => (
              <div
                key={index}
                style={{
                  padding: '0.75rem',
                  border: `1px solid ${getAlertColor(alert.type)}`,
                  borderRadius: '4px',
                  backgroundColor: `${getAlertColor(alert.type)}10`
                }}
              >
                <h4 style={{ margin: 0, color: getAlertColor(alert.type) }}>
                  {alert.title}
                </h4>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trends Analysis */}
      {hasEnoughDataForTrends ? (
        <section className="card">
          <h2>Análisis de Tendencias</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {trends.map((trend, index) => (
              <div
                key={index}
                style={{
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: '#f9fafb'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>{trend.parameter}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      color: getTrendColor(trend.trend),
                      fontWeight: 'bold'
                    }}>
                      {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      backgroundColor: trend.significance === 'high' ? '#fef3c7' :
                                     trend.significance === 'medium' ? '#dbeafe' : '#f3f4f6',
                      color: trend.significance === 'high' ? '#92400e' :
                             trend.significance === 'medium' ? '#1e40af' : '#6b7280'
                    }}>
                      {trend.significance}
                    </span>
                  </div>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#6b7280' }}>
                  {trend.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>Análisis de Tendencias</h2>
          <p>Se necesitan al menos 3 sesiones para generar análisis de tendencias.</p>
          <p>Sesiones actuales: {sessions.length}/3</p>
        </section>
      )}

      {/* Key Findings */}
      {report && report.keyFindings && report.keyFindings.length > 0 && (
        <section className="card">
          <h2>Hallazgos Clave</h2>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {report.keyFindings.map((finding, index) => (
              <li key={index} style={{ marginBottom: '0.5rem' }}>
                {finding}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recommendations */}
      {report && report.recommendations && report.recommendations.length > 0 && (
        <section className="card">
          <h2>Recomendaciones</h2>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {report.recommendations.map((rec, index) => (
              <li key={index} style={{ marginBottom: '0.5rem' }}>
                {rec}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sessions History */}
      {sessions.length > 0 && (
        <section className="card">
          <h2>Historial de Sesiones</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Velocidad (m/s)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Cadencia (spm)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Riesgo</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Patrones</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((session) => (
                  <tr key={session.sessionId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem' }}>{formatDate(session.date)}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {session.metrics.speedMps?.toFixed(2) || '—'}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {session.metrics.cadenceSpm?.toFixed(0) || '—'}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{
                        color: session.riskScore > 70 ? '#dc2626' :
                               session.riskScore > 40 ? '#f59e0b' : '#059669'
                      }}>
                        {session.riskScore}%
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                      {session.patternsSummary.slice(0, 2).join(', ')}
                      {session.patternsSummary.length > 2 && '...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate('/')}
        >
          Volver al inicio
        </button>
        {sessions.length > 0 && (
          <button
            type="button"
            className="secondary-button"
            onClick={exportLongitudinalData}
          >
            Exportar datos
          </button>
        )}
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate('/capture')}
        >
          Nueva sesión
        </button>
      </div>
    </div>
  );
};