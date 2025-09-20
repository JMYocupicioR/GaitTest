import { useState, useEffect } from 'react';
import { DataService } from '../services/dataService.ts';
import type { SessionRecord } from '../lib/supabase.ts';
import { formatSeconds, formatMetersPerSecond } from '../lib/format.ts';

interface LongitudinalAnalysisProps {
  patientId: string;
}

export const LongitudinalAnalysis = ({ patientId }: LongitudinalAnalysisProps) => {
  const [analysisData, setAnalysisData] = useState<{
    sessions: SessionRecord[];
    trends: any;
    csvData: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysisData();
  }, [patientId]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);

      const longitudinalData = await DataService.getLongitudinalAnalysis(patientId);
      const csvData = await DataService.exportPatientDataToCSV(patientId);

      setAnalysisData({
        sessions: longitudinalData.sessions,
        trends: longitudinalData.trends,
        csvData
      });
    } catch (err) {
      setError('Error al cargar el análisis longitudinal');
      console.error('Error loading longitudinal analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!analysisData?.csvData) return;

    const blob = new Blob([analysisData.csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gait_analysis_${patientId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Cargando análisis longitudinal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#dc2626'
        }}>
          <p style={{ margin: 0 }}>{error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={loadAnalysisData}
            style={{ marginTop: '0.5rem' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!analysisData || analysisData.sessions.length === 0) {
    return (
      <div className="card">
        <h2>Análisis Longitudinal</h2>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px dashed #d1d5db'
        }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            No hay datos históricos disponibles para este paciente.
            <br />
            Se necesitan al menos 2 sesiones para generar análisis longitudinal.
          </p>
        </div>
      </div>
    );
  }

  const { sessions, trends } = analysisData;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Análisis Longitudinal</h2>
        <button
          type="button"
          className="secondary-button"
          onClick={downloadCSV}
          style={{ fontSize: '0.9rem' }}
        >
          Descargar CSV
        </button>
      </div>

      {/* Resumen de tendencias */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>Resumen de Evolución</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ fontWeight: 'bold', color: '#1e40af', marginBottom: '0.5rem' }}>
              Periodo de Análisis
            </div>
            <div style={{ fontSize: '0.9rem', color: '#374151' }}>
              {trends.totalSessions} sesiones en {trends.timeSpan?.days || 0} días
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Desde {trends.timeSpan?.start} hasta {trends.timeSpan?.end}
            </div>
          </div>

          {trends.speedChange && (
            <div style={{
              padding: '1rem',
              backgroundColor: trends.speedChange.percentage > 0 ? '#f0fdf4' : '#fef2f2',
              borderRadius: '8px',
              border: `1px solid ${trends.speedChange.percentage > 0 ? '#bbf7d0' : '#fecaca'}`
            }}>
              <div style={{
                fontWeight: 'bold',
                color: trends.speedChange.percentage > 0 ? '#15803d' : '#dc2626',
                marginBottom: '0.5rem'
              }}>
                Velocidad
              </div>
              <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                {trends.speedChange.percentage > 0 ? '+' : ''}{trends.speedChange.percentage.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {formatMetersPerSecond(trends.speedChange.initial)} → {formatMetersPerSecond(trends.speedChange.current)}
              </div>
            </div>
          )}

          {trends.ogsChange && (
            <div style={{
              padding: '1rem',
              backgroundColor: trends.ogsChange.absolute > 0 ? '#f0fdf4' : '#fef2f2',
              borderRadius: '8px',
              border: `1px solid ${trends.ogsChange.absolute > 0 ? '#bbf7d0' : '#fecaca'}`
            }}>
              <div style={{
                fontWeight: 'bold',
                color: trends.ogsChange.absolute > 0 ? '#15803d' : '#dc2626',
                marginBottom: '0.5rem'
              }}>
                Calidad OGS
              </div>
              <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                {trends.ogsChange.absolute > 0 ? '+' : ''}{trends.ogsChange.absolute.toFixed(1)} pts
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {trends.ogsChange.initial.toFixed(1)}% → {trends.ogsChange.current.toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* Mejoras y preocupaciones */}
        {(trends.improvements.length > 0 || trends.concerns.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {trends.improvements.length > 0 && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <h4 style={{ color: '#15803d', margin: '0 0 0.5rem 0' }}>Mejoras Observadas</h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {trends.improvements.map((improvement: string, index: number) => (
                    <li key={index} style={{ color: '#374151', fontSize: '0.9rem' }}>
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trends.concerns.length > 0 && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}>
                <h4 style={{ color: '#dc2626', margin: '0 0 0.5rem 0' }}>Áreas de Atención</h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {trends.concerns.map((concern: string, index: number) => (
                    <li key={index} style={{ color: '#374151', fontSize: '0.9rem' }}>
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historial de sesiones */}
      <div>
        <h3>Historial de Sesiones</h3>
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #d1d5db',
          borderRadius: '8px'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>
                  Fecha
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>
                  Duración
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>
                  Pasos
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>
                  Velocidad
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>
                  OGS
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>
                  Patología
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, index) => (
                <tr key={session.id} style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                }}>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    {new Date(session.session_date).toLocaleDateString('es-ES')}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    {session.duration_seconds ? formatSeconds(session.duration_seconds) : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    {session.steps || '-'}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    {session.avg_speed ? formatMetersPerSecond(session.avg_speed) : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    {session.ogs_quality_index ? `${session.ogs_quality_index.toFixed(1)}%` : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    {session.pathology_detected ? (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        {session.primary_pathology || 'Detectada'}
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#f0fdf4',
                        color: '#15803d',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};