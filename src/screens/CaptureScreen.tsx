import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaRecorder } from '../hooks/useMediaRecorder.ts';
import { usePoseEstimation } from '../hooks/usePoseEstimation.ts';
import { useVideoPoseWorker } from '../hooks/useVideoPoseWorker.ts';
import { useSessionStore } from '../state/sessionStore.ts';
import { assessQuality } from '../lib/quality.ts';
import { PoseOverlay, PoseLegend } from '../components/PoseOverlay.tsx';
import type { QualityLevel } from '../types/session.ts';
import type { HeelStrikeEvent, PoseFrame } from '../lib/poseEstimation.ts';

const getVideoDuration = async (blob: Blob): Promise<number | null> => {
  const video = document.createElement('video');
  const url = URL.createObjectURL(blob);
  try {
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('No se pudo leer la duración del video.'));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
    });
    return Number.isFinite(video.duration) ? video.duration : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const CaptureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const calibrationConfirmed = Boolean((location.state as { calibrationConfirmed?: boolean })?.calibrationConfirmed ?? true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const setVideoBlob = useSessionStore((state) => state.setVideoBlob);
  const setPoseFramesInSession = useSessionStore((state) => state.setPoseFrames);
  const updateQuality = useSessionStore((state) => state.updateQuality);
  const setDuration = useSessionStore((state) => state.setDuration);
  const addHeelStrike = useSessionStore((state) => state.addHeelStrike);
  const clearGaitEvents = useSessionStore((state) => state.clearGaitEvents);
  const syncOfflineAutoHeelStrikes = useSessionStore((state) => state.syncOfflineAutoHeelStrikes);
  const captureSettings = useSessionStore((state) => state.session.captureSettings);
  const [lighting, setLighting] = useState<QualityLevel>('medium');
  const [subjectCentered, setSubjectCentered] = useState(true);
  const [poseFrames, setPoseFrames] = useState<PoseFrame[]>([]);
  const [latestPoseFrame, setLatestPoseFrame] = useState<PoseFrame | null>(null);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [detectedEvents, setDetectedEvents] = useState(0);
  const [uploadedVideoBlob, setUploadedVideoBlob] = useState<Blob | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [isOfflineProcessing, setIsOfflineProcessing] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState(0);

  const recorder = useMediaRecorder({ targetFps: captureSettings.targetFps, videoRef });
  const videoPoseWorker = useVideoPoseWorker({
    sampleFps: Math.max(15, Math.min(30, captureSettings.targetFps || 30)),
  });

  const poseEstimation = usePoseEstimation({
    getFrameTimestampSeconds: () => {
      if (recorder.state === 'recording') {
        return recorder.getRecordingElapsedSeconds();
      }
      const el = videoRef.current;
      if (el && Number.isFinite(el.currentTime)) {
        return Math.max(0, el.currentTime);
      }
      return null;
    },
    onHeelStrike: (event: HeelStrikeEvent) => {
      if (autoDetectionEnabled && recorder.state === 'recording') {
        addHeelStrike(event.foot, event.timestamp, 'auto', event.confidence);
        setDetectedEvents((prev) => prev + 1);
      }
    },
    onPoseDetected: (frame: PoseFrame) => {
      setLatestPoseFrame(frame);
      if (recorder.state === 'recording') {
        setPoseFrames((prev) => [...prev.slice(-599), frame]);
      }
    },
  });

  useEffect(() => {
    const initializeCapture = async () => {
      try {
        await recorder.startCamera();

        if (videoRef.current && autoDetectionEnabled) {
          await poseEstimation.initialize(videoRef.current);
          poseEstimation.startAnalysis();
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

  useEffect(() => {
    if (recorder.state === 'recording' && autoDetectionEnabled) {
      poseEstimation.startAnalysis();
      setDetectedEvents(0);
      setPoseFrames([]);
      setPoseFramesInSession([]);
    } else if (recorder.state === 'complete') {
      poseEstimation.stopAnalysis();
      setPoseFramesInSession(poseFrames);
    }
  }, [recorder.state, autoDetectionEnabled, poseEstimation, poseFrames, setPoseFramesInSession, clearGaitEvents]);

  useEffect(() => {
    if (!recorder.recordedBlob) {
      return;
    }
    setUploadedVideoBlob(null);
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

  useEffect(() => {
    return () => {
      if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl);
      }
    };
  }, [uploadedVideoUrl]);

  const processBlobOffline = async (blob: Blob): Promise<PoseFrame[]> => {
    setIsOfflineProcessing(true);
    setOfflineProgress(0);
    try {
      const result = await videoPoseWorker.runExtraction(blob, {
        onProgress: (progress) => setOfflineProgress(progress),
      });
      setPoseFrames(result.frames);
      setPoseFramesInSession(result.frames);
      syncOfflineAutoHeelStrikes(result.heelStrikes);
      setDetectedEvents(result.heelStrikes.length);
      return result.frames;
    } finally {
      setIsOfflineProcessing(false);
      setOfflineProgress(0);
    }
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    recorder.stopCamera();
    poseEstimation.stopAnalysis();
    clearGaitEvents();

    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedVideoUrl(objectUrl);
    setUploadedVideoBlob(file);
    setVideoBlob(file);
    setPoseFrames([]);
    setPoseFramesInSession([]);
    setDetectedEvents(0);

    const duration = await getVideoDuration(file);
    setDuration(duration);
    updateQuality(
      assessQuality({
        durationSeconds: duration,
        fpsDetected: captureSettings.targetFps,
        lightingScore: lighting,
        calibrationConfirmed,
        subjectCentered,
      }),
    );

    if (autoDetectionEnabled) {
      await processBlobOffline(file);
    }
  };

  const handleContinue = async () => {
    const analysisBlob = uploadedVideoBlob ?? recorder.recordedBlob ?? null;
    if (!analysisBlob) return;

    if (autoDetectionEnabled && poseFrames.length === 0) {
      await processBlobOffline(analysisBlob);
    }

    navigate('/events');
  };

  const readyForNext = useMemo(
    () => Boolean(uploadedVideoBlob || (recorder.state === 'complete' && recorder.recordedBlob)),
    [uploadedVideoBlob, recorder.recordedBlob, recorder.state],
  );

  return (
    <div className="page">
      <span className="step-indicator">Paso 3 · Captura</span>
      <header className="page-header">
        <h1>Graba la marcha</h1>
        <p>Coloca a la persona a 3 metros del móvil. Cuando todo esté listo, pulsa grabar y camina de ida y vuelta.</p>
      </header>

      <section className="card video-shell">
        {uploadedVideoUrl ? (
          <div className="video-stage">
            <video ref={playbackVideoRef} playsInline controls src={uploadedVideoUrl} />
            <PoseOverlay
              mode="playback"
              videoRef={playbackVideoRef}
              frames={poseFrames}
              visible={showSkeleton && poseFrames.length > 0}
            />
          </div>
        ) : (
          <div className="video-stage">
            <video ref={videoRef} playsInline muted controls={recorder.state === 'complete'} autoPlay />
            <PoseOverlay
              mode="live"
              videoRef={videoRef}
              liveFrame={latestPoseFrame}
              visible={showSkeleton && autoDetectionEnabled}
            />
          </div>
        )}
        {showSkeleton && (autoDetectionEnabled || poseFrames.length > 0) && <PoseLegend />}
        <div className="button-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            style={{ display: 'none' }}
            onChange={handleVideoUpload}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isOfflineProcessing || recorder.state === 'recording'}
          >
            Cargar video
          </button>
          {recorder.state !== 'recording' && (
            <button type="button" className="primary-button" onClick={recorder.startRecording} disabled={isOfflineProcessing}>
              Grabar
            </button>
          )}
          {recorder.state === 'recording' && (
            <button type="button" className="primary-button" onClick={recorder.stopRecording}>
              Detener
            </button>
          )}
          {recorder.state === 'complete' && !uploadedVideoBlob && (
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

        <label className="touch-checkbox-label">
          <input
            type="checkbox"
            checked={subjectCentered}
            onChange={(event) => setSubjectCentered(event.target.checked)}
          />
          <span>La persona se mantuvo dentro del encuadre durante todo el clip.</span>
        </label>

        <label className="touch-checkbox-label">
          <input
            type="checkbox"
            checked={autoDetectionEnabled}
            onChange={(event) => setAutoDetectionEnabled(event.target.checked)}
          />
          <span>Detección automática de eventos con IA (recomendado)</span>
        </label>

        <label className="touch-checkbox-label">
          <input
            type="checkbox"
            checked={showSkeleton}
            onChange={(event) => setShowSkeleton(event.target.checked)}
          />
          <span>Mostrar puntos corporales sobre el video</span>
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
        {isOfflineProcessing && (
          <div className="offline-progress" aria-live="polite">
            <p className="helper-text" style={{ color: '#2563eb' }}>
              Procesando video offline con IA... {Math.round(offlineProgress * 100)}%
            </p>
            <div className="offline-progress-track" aria-hidden="true">
              <div className="offline-progress-fill" style={{ width: `${Math.round(offlineProgress * 100)}%` }} />
            </div>
          </div>
        )}
      </section>

      <div className="button-row page-actions">
        <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
          Volver
        </button>
        <button type="button" className="primary-button" disabled={!readyForNext || isOfflineProcessing} onClick={handleContinue}>
          Continuar a anotación
        </button>
      </div>
    </div>
  );
};
