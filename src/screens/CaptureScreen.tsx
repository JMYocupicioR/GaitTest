import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaRecorder } from '../hooks/useMediaRecorder.ts';
import { usePoseEstimation } from '../hooks/usePoseEstimation.ts';
import { useSessionStore } from '../state/sessionStore.ts';
import { assessQuality } from '../lib/quality.ts';
import type { QualityLevel } from '../types/session.ts';
import type { HeelStrikeEvent, PoseFrame } from '../lib/poseEstimation.ts';

export const CaptureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const calibrationConfirmed = Boolean((location.state as { calibrationConfirmed?: boolean })?.calibrationConfirmed ?? true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoBlob = useSessionStore((state) => state.setVideoBlob);
  const updateQuality = useSessionStore((state) => state.updateQuality);
  const setDuration = useSessionStore((state) => state.setDuration);
  const addHeelStrike = useSessionStore((state) => state.addHeelStrike);
  const captureSettings = useSessionStore((state) => state.session.captureSettings);
  const [lighting, setLighting] = useState<QualityLevel>('medium');
  const [subjectCentered, setSubjectCentered] = useState(true);
  const [poseFrames, setPoseFrames] = useState<PoseFrame[]>([]);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true);
  const [detectedEvents, setDetectedEvents] = useState(0);

  const recorder = useMediaRecorder({ targetFps: captureSettings.targetFps, videoRef });

  // Pose estimation hooks
  const poseEstimation = usePoseEstimation({
    onHeelStrike: (event: HeelStrikeEvent) => {
      if (autoDetectionEnabled && recorder.state === 'recording') {
        addHeelStrike(event.foot, event.timestamp, 'auto');
        setDetectedEvents(prev => prev + 1);
      }
    },
    onPoseDetected: (frame: PoseFrame) => {
      if (recorder.state === 'recording') {
        setPoseFrames(prev => [...prev.slice(-50), frame]); // Keep last 50 frames
      }
    }
  });

  useEffect(() => {
    const initializeCapture = async () => {
      try {
        await recorder.startCamera();

        // Initialize pose estimation when video is ready
        if (videoRef.current && autoDetectionEnabled) {
          await poseEstimation.initialize(videoRef.current);
        }
      } catch (error) {
        console.error('Error initializing capture:', error);
      }
    };

    initializeCapture();

    return () => {
      recorder.stopCamera();
      poseEstimation.cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start/stop pose estimation with recording
  useEffect(() => {
    if (recorder.state === 'recording' && autoDetectionEnabled) {
      poseEstimation.startAnalysis();
      setDetectedEvents(0);
      setPoseFrames([]);
    } else if (recorder.state === 'complete') {
      poseEstimation.stopAnalysis();
    }
  }, [recorder.state, autoDetectionEnabled, poseEstimation]);

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

        <label style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={autoDetectionEnabled}
            onChange={(event) => setAutoDetectionEnabled(event.target.checked)}
          />
          <span>Detección automática de eventos con IA (recomendado)</span>
        </label>

        {recorder.durationSeconds && (
          <p className="helper-text">
            Duración estimada: {recorder.durationSeconds.toFixed(1)} s · FPS detectado: {recorder.fpsDetected?.toFixed?.(0) ?? '—'}
            {autoDetectionEnabled && ` · Eventos detectados: ${detectedEvents}`}
          </p>
        )}

        {autoDetectionEnabled && poseFrames.length > 0 && (
          <p className="helper-text" style={{ color: '#059669' }}>
            ✓ Pose estimation activa - {poseFrames.length} frames analizados
          </p>
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
