import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaRecorder } from '../hooks/useMediaRecorder.ts';
import { useSessionStore } from '../state/sessionStore.ts';
import { assessQuality } from '../lib/quality.ts';
import type { QualityLevel } from '../types/session.ts';

export const CaptureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const calibrationConfirmed = Boolean((location.state as { calibrationConfirmed?: boolean })?.calibrationConfirmed ?? true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoBlob = useSessionStore((state) => state.setVideoBlob);
  const updateQuality = useSessionStore((state) => state.updateQuality);
  const setDuration = useSessionStore((state) => state.setDuration);
  const captureSettings = useSessionStore((state) => state.session.captureSettings);
  const [lighting, setLighting] = useState<QualityLevel>('medium');
  const [subjectCentered, setSubjectCentered] = useState(true);

  const recorder = useMediaRecorder({ targetFps: captureSettings.targetFps, videoRef });

  useEffect(() => {
    recorder.startCamera();
    return () => {
      recorder.stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!recorder.recordedBlob) {
      return;
    }
    setVideoBlob(recorder.recordedBlob);
    setDuration(recorder.durationSeconds ?? null);
    const quality = assessQuality({
      durationSeconds: recorder.durationSeconds ?? null,
      fpsDetected: recorder.fpsDetected,
      lightingScore: lighting,
      calibrationConfirmed,
      subjectCentered,
    });
    updateQuality(quality);
  }, [calibrationConfirmed, lighting, recorder.durationSeconds, recorder.fpsDetected, recorder.recordedBlob, subjectCentered, setDuration, setVideoBlob, updateQuality]);

  const readyForNext = useMemo(
    () => recorder.state === 'complete' && !!recorder.recordedBlob,
    [recorder.recordedBlob, recorder.state],
  );

  return (
    <div className="page">
      <span className="step-indicator">Paso 3 · Captura</span>
      <header className="page-header">
        <h1>Graba la marcha</h1>
        <p>Coloca a la persona a 3 metros del móvil. Cuando todo esté listo, pulsa grabar y camina de ida y vuelta.</p>
      </header>

      <section className="card video-shell">
        <video ref={videoRef} playsInline muted controls={recorder.state === 'complete'} autoPlay />
        <div className="button-row">
          {recorder.state !== 'recording' && (
            <button type="button" className="primary-button" onClick={recorder.startRecording}>
              Grabar
            </button>
          )}
          {recorder.state === 'recording' && (
            <button type="button" className="primary-button" onClick={recorder.stopRecording}>
              Detener
            </button>
          )}
          {recorder.state === 'complete' && (
            <button type="button" className="secondary-button" onClick={() => recorder.startRecording()}>
              Repetir captura
            </button>
          )}
        </div>
        {recorder.error && <p className="helper-text" style={{ color: '#dc2626' }}>{recorder.error}</p>}
        <p className="helper-text">Consejo: espera un segundo antes de iniciar la marcha para asegurar un inicio limpio del clip.</p>
      </section>

      <section className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div className="form-section">
          <label>Iluminación</label>
          <select value={lighting} onChange={(event) => setLighting(event.target.value as QualityLevel)}>
            <option value="high">Alta (uniforme)</option>
            <option value="medium">Media (aceptable)</option>
            <option value="low">Baja (sombras / contraluz)</option>
          </select>
        </div>

        <label style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={subjectCentered}
            onChange={(event) => setSubjectCentered(event.target.checked)}
          />
          <span>La persona se mantuvo dentro del encuadre durante todo el clip.</span>
        </label>

        {recorder.durationSeconds && (
          <p className="helper-text">Duración estimada: {recorder.durationSeconds.toFixed(1)} s · FPS detectado: {recorder.fpsDetected?.toFixed?.(0) ?? '—'}</p>
        )}
      </section>

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
          Volver
        </button>
        <button type="button" className="primary-button" disabled={!readyForNext} onClick={() => navigate('/events')}>
          Continuar a anotación
        </button>
      </div>
    </div>
  );
};
