import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';
import { formatCadence, formatMetersPerSecond, formatSeconds, formatMeters, formatPercentage } from '../lib/format.ts';
import { OGSValidationPanel } from '../components/OGSValidationPanel.tsx';
import { LongitudinalAnalysis } from '../components/LongitudinalAnalysis.tsx';
import { PatientSearch } from '../components/PatientSearch.tsx';
import { GaitPhaseDiagram } from '../components/GaitPhaseDiagram.tsx';
import { KinematicChartCanvas } from '../components/KinematicChartCanvas.tsx';
import { PoseOverlay, PoseLegend } from '../components/PoseOverlay.tsx';
import { SymmetryRadarChart } from '../components/SymmetryRadarChart.tsx';
import { PhaseHeatmap } from '../components/PhaseHeatmap.tsx';
import { buildSymmetryRadar } from '../lib/symmetryRadar.ts';
import { useAuth } from '../hooks/useAuth.ts';

const MAX_VISIBILITY_POINTS = 240;
const MAX_TIMELINE_MARKERS = 300;
const MAX_EVENT_CHIPS = 120;
const MAX_CHART_POINTS = 180;

function sampleArray<T>(items: readonly T[], maxItems: number): T[] {
  if (items.length <= maxItems) return [...items];
  const step = (items.length - 1) / (maxItems - 1);
  return Array.from({ length: maxItems }, (_, index) => items[Math.round(index * step)]);
}

function sampleNumericSeries(series: readonly number[] | null | undefined): number[] | null {
  if (!series?.length) return null;
  return sampleArray(series, MAX_CHART_POINTS);
}

export const ResultsScreen = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const saveSessionToDatabase = useSessionStore((state) => state.saveSessionToDatabase);
  const setCaptureSettings = useSessionStore((state) => state.setCaptureSettings);
  const { user } = useAuth();

  const [showLongitudinalAnalysis, setShowLongitudinalAnalysis] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [advancedVisualsReady, setAdvancedVisualsReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoTime, setVideoTime] = useState(0);

  const quality = session.quality;
  const enhancedAnalysisResult = session.enhancedAnalysisResult as (typeof session.enhancedAnalysisResult & {
    compensationAnalysis?: import('../lib/compensationDetection.ts').CompensationAnalysis;
  }) | undefined;
  const symmetryRadarData = useMemo(() => buildSymmetryRadar(session), [session]);
  const lowConfidencePct = useMemo(() => {
    const frames = session.poseFrames ?? [];
    if (!frames.length) return 0;
    const low = frames.filter((frame) => {
      const key = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
      const mean =
        key.reduce((sum, idx) => sum + (frame.landmarks?.[idx]?.visibility ?? 0), 0) / key.length;
      return mean < 0.5;
    }).length;
    return (low / frames.length) * 100;
  }, [session.poseFrames]);
  const visibilitySeries = useMemo(() => {
    const frames = session.poseFrames ?? [];
    if (!frames.length) return [] as Array<{ t: number; v: number }>;
    const key = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    const sampledFrames = sampleArray(frames, MAX_VISIBILITY_POINTS);
    return sampledFrames.map((frame) => ({
      t: frame.timestamp,
      v: key.reduce((sum, idx) => sum + (frame.landmarks?.[idx]?.visibility ?? 0), 0) / key.length,
    }));
  }, [session.poseFrames]);
  const sortedEvents = useMemo(
    () => [...session.events].sort((a, b) => a.timestamp - b.timestamp),
    [session.events],
  );
  const timelineEvents = useMemo(
    () => sampleArray(sortedEvents, MAX_TIMELINE_MARKERS),
    [sortedEvents],
  );
  const eventChips = useMemo(
    () => sortedEvents.slice(0, MAX_EVENT_CHIPS),
    [sortedEvents],
  );
  const hiddenEventCount = Math.max(0, sortedEvents.length - eventChips.length);
  const kinematicChartData = useMemo(() => {
    const sagittal = session.enhancedAnalysisResult?.kinematicSummary?.kinematicData?.sagittal;
    return {
      hipLeft: sampleNumericSeries(
        sagittal?.hipFlexion?.left?.summary?.normalizedCycles?.mean101 ??
        sagittal?.hipFlexion?.left?.series?.angles,
      ),
      hipRight: sampleNumericSeries(
        sagittal?.hipFlexion?.right?.summary?.normalizedCycles?.mean101 ??
        sagittal?.hipFlexion?.right?.series?.angles,
      ),
      kneeLeft: sampleNumericSeries(
        sagittal?.kneeFlexion?.left?.summary?.normalizedCycles?.mean101 ??
        sagittal?.kneeFlexion?.left?.series?.angles,
      ),
      kneeRight: sampleNumericSeries(
        sagittal?.kneeFlexion?.right?.summary?.normalizedCycles?.mean101 ??
        sagittal?.kneeFlexion?.right?.series?.angles,
      ),
      ankleLeft: sampleNumericSeries(
        sagittal?.ankleFlexion?.left?.summary?.normalizedCycles?.mean101 ??
        sagittal?.ankleFlexion?.left?.series?.angles,
      ),
      ankleRight: sampleNumericSeries(
        sagittal?.ankleFlexion?.right?.summary?.normalizedCycles?.mean101 ??
        sagittal?.ankleFlexion?.right?.series?.angles,
      ),
    };
  }, [session.enhancedAnalysisResult?.kinematicSummary]);
  const timelineDuration = useMemo(() => {
    const fromVideo = videoDuration > 0 ? videoDuration : 0;
    const fromQuality = session.quality.durationSeconds ?? 0;
    const fromEvents = sortedEvents.at(-1)?.timestamp ?? 0;
    return Math.max(fromVideo, fromQuality, fromEvents, 1);
  }, [session.quality.durationSeconds, sortedEvents, videoDuration]);
  const videoUrl = useMemo(() => {
    if (!session.videoBlob) return null;
    return URL.createObjectURL(session.videoBlob);
  }, [session.videoBlob]);

  useEffect(() => () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
  }, [videoUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAdvancedVisualsReady(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => {
      if (Number.isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };
    const onTimeUpdate = () => setVideoTime(video.currentTime);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [videoUrl]);

  const jumpToEvent = (timestamp: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = timestamp;
    void videoRef.current.play().catch(() => undefined);
  };

  const handleCaptureFrontalComplement = () => {
    setCaptureSettings({ viewMode: 'frontal' });
    navigate('/capture');
  };

  const handleSaveSession = async () => {
    setSaving(true);
    try {
      const sessionId = await saveSessionToDatabase();
      if (sessionId) {
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { type: 'success', message: 'Sesión guardada exitosamente en la base de datos.' },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { type: 'error', message: 'No se pudo guardar la sesión.' },
          }),
        );
      }
    } catch (error) {
      console.error('Error saving session:', error);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'error', message: 'Error al guardar la sesión.' },
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePatientSelect = (patientId: string, patientName: string) => {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
    setShowLongitudinalAnalysis(true);
  };

  return (
    <div className="page">
      <span className="step-indicator">Paso 5 · Resultados</span>
      <header className="page-header">
        <h1>Métricas del clip</h1>
        <p>Interpretación automáticamente generada. Usa estos datos para orientar la valoración clínica.</p>
      </header>

      {videoUrl && (
        <section className="card video-shell">
          <h2>Video con esqueleto y eventos</h2>
          <div className="video-stage">
            <video ref={videoRef} controls src={videoUrl} playsInline />
            <PoseOverlay
              mode="playback"
              videoRef={videoRef}
              frames={session.poseFrames ?? []}
              visible={showSkeleton && (session.poseFrames?.length ?? 0) > 0}
            />
          </div>
          <label className="touch-checkbox-label" style={{ color: '#cbd5e1' }}>
            <input
              type="checkbox"
              checked={showSkeleton}
              onChange={(event) => setShowSkeleton(event.target.checked)}
            />
            <span>Mostrar puntos corporales sobre el video</span>
          </label>
          {showSkeleton && <PoseLegend />}
          {sortedEvents.length > 0 && (
            <>
              <div className="event-timeline">
                <div className="event-track results-event-track">
                  <div
                    className="event-playhead"
                    style={{ left: `${Math.min(100, (videoTime / timelineDuration) * 100)}%` }}
                  />
                  {timelineEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`event-marker ${event.type === 'toe_off' ? 'toeoff' : 'heelstrike'}`}
                      style={{ left: `${Math.min(100, (event.timestamp / timelineDuration) * 100)}%` }}
                      title={`${event.type} ${event.foot} · ${event.timestamp.toFixed(2)} s`}
                      onClick={() => jumpToEvent(event.timestamp)}
                    />
                  ))}
                </div>
                <div className="event-timeline-labels">
                  <span>0.0 s</span>
                  <span>{timelineDuration.toFixed(1)} s</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {eventChips.map((event) => (
                  <button
                    key={`chip-${event.id}`}
                    type="button"
                    className="badge medium"
                    title={`${event.type} ${event.foot}`}
                    onClick={() => jumpToEvent(event.timestamp)}
                  >
                    {event.type === 'heel_strike' ? 'IC' : event.type === 'toe_off' ? 'TO' : event.type} {event.foot}:{' '}
                    {event.timestamp.toFixed(2)}s
                  </button>
                ))}
                {hiddenEventCount > 0 && (
                  <span className="badge medium">
                    +{hiddenEventCount} eventos ocultos para rendimiento
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>Métricas temporoespaciales</h2>
        {lowConfidencePct > 30 && (
          <p className="helper-text" style={{ color: '#b91c1c', fontWeight: 600 }}>
            Datos de baja calidad: {Math.round(lowConfidencePct)}% de frames con baja visibilidad. Interpretar con precaución.
          </p>
        )}
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
        {visibilitySeries.length > 1 && (
          <div>
            <p className="helper-text" style={{ marginBottom: '0.4rem' }}>
              Confianza de landmarks en el tiempo
            </p>
            <svg viewBox="0 0 320 72" width="100%" height="72" aria-label="Curva de confianza de pose">
              <rect x="0" y="0" width="320" height="72" fill="#f8fafc" rx="8" />
              <line x1="0" y1="50" x2="320" y2="50" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="0" y1="36" x2="320" y2="36" stroke="#fde68a" strokeWidth="1" />
              <line x1="0" y1="22" x2="320" y2="22" stroke="#bbf7d0" strokeWidth="1" />
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                points={visibilitySeries
                  .map((point, idx) => {
                    const x = (idx / (visibilitySeries.length - 1)) * 320;
                    const y = 64 - Math.max(0, Math.min(1, point.v)) * 50;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>
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
          kinematics={enhancedAnalysisResult?.kinematicSummary}
          compensations={enhancedAnalysisResult?.compensationAnalysis}
        />
      )}

      {advancedVisualsReady ? (
        <>
          {/* ─── Visualización de Fases de la Marcha ─── */}
          <GaitPhaseDiagram
            ogsLeft={session.ogs?.leftScore}
            ogsRight={session.ogs?.rightScore}
          />

          {/* ─── Cinemática Articular ─── */}
          <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <h2>Cinemática Articular</h2>
            <p className="helper-text">
              Ángulos articulares (azul=izq, rojo=der) con bandas normativas (gris ±1 DE)
            </p>
            <KinematicChartCanvas
              jointIndex={0}
              patientProfile={session.patient}
              patientDataLeft={kinematicChartData.hipLeft}
              patientDataRight={kinematicChartData.hipRight}
            />
            <KinematicChartCanvas
              jointIndex={1}
              patientProfile={session.patient}
              patientDataLeft={kinematicChartData.kneeLeft}
              patientDataRight={kinematicChartData.kneeRight}
            />
            <KinematicChartCanvas
              jointIndex={2}
              patientProfile={session.patient}
              patientDataLeft={kinematicChartData.ankleLeft}
              patientDataRight={kinematicChartData.ankleRight}
            />
          </section>

          <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <h2>Simetría y fases</h2>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <SymmetryRadarChart data={symmetryRadarData} />
              <PhaseHeatmap summary={session.enhancedAnalysisResult?.kinematicSummary} />
            </div>
          </section>
        </>
      ) : (
        <section className="card">
          <h2>Visualizaciones avanzadas</h2>
          <p className="helper-text">Preparando gráficas sin bloquear la página...</p>
        </section>
      )}

      {/* Almacenamiento y análisis longitudinal */}
      <section className="card">
        <h2>Almacenamiento y análisis longitudinal</h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleSaveSession}
              disabled={saving || !user}
              style={{ opacity: saving || !user ? 0.6 : 1 }}
            >
              {saving ? 'Guardando...' : 'Guardar sesión en base de datos'}
            </button>
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              {user
                ? 'Se guardan metricas clinicas, series cinematicas y fotogramas clave compactos.'
                : 'Inicia sesion para guardar sesiones en Supabase.'}
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

      <div className="button-row page-actions">
        <button type="button" className="secondary-button" onClick={() => navigate('/events')}>
          Ajustar anotaciones
        </button>
        {session.captureSettings.viewMode === 'dual' && (
          <button type="button" className="secondary-button" onClick={handleCaptureFrontalComplement}>
            Capturar vista frontal complementaria
          </button>
        )}
        <button type="button" className="primary-button" onClick={() => navigate('/report')}>
          Generar informe
        </button>
      </div>
    </div>
  );
};
