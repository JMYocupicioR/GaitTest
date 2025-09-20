import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';
import { formatCadence, formatMetersPerSecond, formatSeconds } from '../lib/format.ts';
import { OGSValidationPanel } from '../components/OGSValidationPanel.tsx';
import { LongitudinalAnalysis } from '../components/LongitudinalAnalysis.tsx';
import { PatientSearch } from '../components/PatientSearch.tsx';
import { initializeDatabase, checkTables } from '../scripts/initDatabase.ts';

export const ResultsScreen = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const saveSessionToDatabase = useSessionStore((state) => state.saveSessionToDatabase);

  const [showLongitudinalAnalysis, setShowLongitudinalAnalysis] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ gaitTable: boolean; sessionTable: boolean } | null>(null);
  const [initializingDb, setInitializingDb] = useState(false);

  const quality = session.quality;

  const handleSaveSession = async () => {
    setSaving(true);
    try {
      const sessionId = await saveSessionToDatabase();
      if (sessionId) {
        alert('Sesión guardada exitosamente en la base de datos');
      } else {
        alert('Error al guardar la sesión');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Error al guardar la sesión');
    } finally {
      setSaving(false);
    }
  };

  const handlePatientSelect = (patientId: string, patientName: string) => {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
    setShowLongitudinalAnalysis(true);
  };

  const handleInitializeDatabase = async () => {
    setInitializingDb(true);
    try {
      const success = await initializeDatabase();
      if (success) {
        alert('Base de datos inicializada correctamente');
        checkDatabaseStatus();
      } else {
        alert('Error al inicializar la base de datos. Revisa la consola para más detalles.');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      alert('Error al inicializar la base de datos');
    } finally {
      setInitializingDb(false);
    }
  };

  const checkDatabaseStatus = async () => {
    try {
      const status = await checkTables();
      setDbStatus(status);
    } catch (error) {
      console.error('Error checking database status:', error);
    }
  };

  // Check database status on component mount
  useEffect(() => {
    checkDatabaseStatus();
  }, []);

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
          kinematics={undefined}
          compensations={undefined}
        />
      )}

      {/* Almacenamiento y análisis longitudinal */}
      <section className="card">
        <h2>Almacenamiento y análisis longitudinal</h2>

        {/* Database Status */}
        {dbStatus && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.9rem' }}>
              <strong>Estado de la base de datos:</strong>
              <span style={{ marginLeft: '0.5rem', color: dbStatus.gaitTable && dbStatus.sessionTable ? '#15803d' : '#dc2626' }}>
                {dbStatus.gaitTable && dbStatus.sessionTable ? '✓ Conectada' : '⚠ Requiere inicialización'}
              </span>
            </div>
            {(!dbStatus.gaitTable || !dbStatus.sessionTable) && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleInitializeDatabase}
                disabled={initializingDb}
                style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
              >
                {initializingDb ? 'Inicializando...' : 'Inicializar base de datos'}
              </button>
            )}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleSaveSession}
              disabled={saving || !dbStatus?.gaitTable || !dbStatus?.sessionTable}
              style={{ opacity: saving || (!dbStatus?.gaitTable || !dbStatus?.sessionTable) ? 0.6 : 1 }}
            >
              {saving ? 'Guardando...' : 'Guardar sesión en base de datos'}
            </button>
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Los datos se guardarán en formato CSV compatible para análisis
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Buscar análisis longitudinal</h3>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1rem' }}>
            Busca un paciente existente para ver su evolución a lo largo del tiempo
          </p>
          <PatientSearch
            onPatientSelect={handlePatientSelect}
            selectedPatientId={selectedPatientId}
          />
        </div>

        {showLongitudinalAnalysis && selectedPatientId && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Análisis para: {selectedPatientName}</h3>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowLongitudinalAnalysis(false)}
                style={{ fontSize: '0.9rem' }}
              >
                Ocultar análisis
              </button>
            </div>
            <LongitudinalAnalysis patientId={selectedPatientId} />
          </div>
        )}
      </section>

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
