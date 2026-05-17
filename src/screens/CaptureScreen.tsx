import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaRecorder } from '../hooks/useMediaRecorder.ts';
import { usePoseEstimation } from '../hooks/usePoseEstimation.ts';
import { useVideoPoseWorker } from '../hooks/useVideoPoseWorker.ts';
import { useSessionStore } from '../state/sessionStore.ts';
import { assessQuality } from '../lib/quality.ts';
import { estimateHeightFromPose } from '../lib/biometricCalibration.ts';
import { LiveHeightOverlay } from '../components/LiveHeightOverlay.tsx';
import { PoseOverlay, PoseLegend } from '../components/PoseOverlay.tsx';
import type { QualityLevel } from '../types/session.ts';
import type { HeelStrikeEvent, PoseFrame } from '../lib/poseEstimation.ts';

interface LivePoseMetrics {
  estimatedHeightCm: number | null;
  heightConfidence: number | null;
  leftKneeAngle: number | null;
  rightKneeAngle: number | null;
  leftHipAngle: number | null;
  rightHipAngle: number | null;
  poseConfidence: number | null;
  poseFps: number | null;
}

const LIVE_METRIC_VISIBILITY_INDICES = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] as const;
const EMPTY_LIVE_METRICS: LivePoseMetrics = {
  estimatedHeightCm: null,
  heightConfidence: null,
  leftKneeAngle: null,
  rightKneeAngle: null,
  leftHipAngle: null,
  rightHipAngle: null,
  poseConfidence: null,
  poseFps: null,
};

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
  const patient = useSessionStore((state) => state.session.patient);
  const [lighting, setLighting] = useState<QualityLevel>('medium');
  const [subjectCentered, setSubjectCentered] = useState(true);
  const [poseFrames, setPoseFrames] = useState<PoseFrame[]>([]);
  const [latestPoseFrame, setLatestPoseFrame] = useState<PoseFrame | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LivePoseMetrics>(EMPTY_LIVE_METRICS);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [detectedEvents, setDetectedEvents] = useState(0);
  const [uploadedVideoBlob, setUploadedVideoBlob] = useState<Blob | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isOfflineProcessing, setIsOfflineProcessing] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState(0);
  const poseFramesRef = useRef<PoseFrame[]>([]);
  const poseMetricsBufferRef = useRef<PoseFrame[]>([]);
  const lastMetricsUpdateRef = useRef(0);
  const lastPoseTimestampRef = useRef<number | null>(null);
  const poseFpsRef = useRef<number | null>(null);

  const recorder = useMediaRecorder({ targetFps: captureSettings.targetFps, videoRef });
  const startCameraRef = useRef(recorder.startCamera);
  const videoPoseWorker = useVideoPoseWorker({
    sampleFps: Math.max(15, Math.min(30, captureSettings.targetFps || 30)),
  });

  const {
    initialize: initializePoseEstimation,
    startAnalysis: startPoseAnalysis,
    stopAnalysis: stopPoseAnalysis,
    cleanup: cleanupPoseEstimation,
    calculateJointAngles,
  } = usePoseEstimation({
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

      const metricsBuffer = [...poseMetricsBufferRef.current, frame].slice(-180);
      poseMetricsBufferRef.current = metricsBuffer;

      if (lastPoseTimestampRef.current != null) {
        const delta = frame.timestamp - lastPoseTimestampRef.current;
        if (delta > 0.001 && delta < 1) {
          const instantFps = 1 / delta;
          poseFpsRef.current =
            poseFpsRef.current == null
              ? instantFps
              : poseFpsRef.current * 0.85 + instantFps * 0.15;
        }
      }
      lastPoseTimestampRef.current = frame.timestamp;

      const now = performance.now();
      if (now - lastMetricsUpdateRef.current >= 200) {
        lastMetricsUpdateRef.current = now;
        const confidenceValues = LIVE_METRIC_VISIBILITY_INDICES
          .map((idx) => frame.landmarks[idx]?.visibility ?? 0)
          .filter((value) => Number.isFinite(value));
        const poseConfidence =
          confidenceValues.length > 0
            ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
            : null;
        const angles = calculateJointAngles(frame);
        const heightEstimate = estimateHeightFromPose(metricsBuffer, {
          frameGroundWidthMeters: captureSettings.frameGroundWidthMeters,
          pxPerMeter: captureSettings.pxPerMeter,
        });

        setLiveMetrics({
          estimatedHeightCm: heightEstimate?.heightCm ?? null,
          heightConfidence: heightEstimate?.confidence ?? null,
          leftKneeAngle: angles?.leftKneeAngle ?? null,
          rightKneeAngle: angles?.rightKneeAngle ?? null,
          leftHipAngle: angles?.leftHipAngle ?? null,
          rightHipAngle: angles?.rightHipAngle ?? null,
          poseConfidence,
          poseFps: poseFpsRef.current,
        });
      }

      if (recorder.state === 'recording') {
        setPoseFrames((prev) => {
          const next = [...prev.slice(-599), frame];
          poseFramesRef.current = next;
          return next;
        });
      }
    },
  });

  useEffect(() => {
    const initializeCapture = async () => {
      try {
        await recorder.startCamera();

        if (videoRef.current && autoDetectionEnabled) {
          await initializePoseEstimation(videoRef.current);
          startPoseAnalysis();
        }
      } catch (error) {
        console.error('Error initializing capture:', error);
      }
    };

    initializeCapture();

    return () => {
      recorder.stopCamera();
      cleanupPoseEstimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recorder.state === 'recording' && autoDetectionEnabled) {
      startPoseAnalysis();
      setDetectedEvents(0);
      setPoseFrames([]);
      poseFramesRef.current = [];
      setPoseFramesInSession([]);
      poseMetricsBufferRef.current = [];
      lastPoseTimestampRef.current = null;
      poseFpsRef.current = null;
      setLiveMetrics(EMPTY_LIVE_METRICS);
    } else if (recorder.state === 'complete') {
      stopPoseAnalysis();
      setPoseFramesInSession(poseFramesRef.current);
    } else if (recorder.state === 'preview' && autoDetectionEnabled) {
      // Reanudar el esqueleto en directo al volver al modo previsualización
      // (por ejemplo tras "Repetir captura").
      startPoseAnalysis();
    } else {
      stopPoseAnalysis();
    }
  }, [autoDetectionEnabled, recorder.state, setPoseFramesInSession, startPoseAnalysis, stopPoseAnalysis]);

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
    if (!recorder.recordedBlob) {
      return;
    }
    const url = URL.createObjectURL(recorder.recordedBlob);
    setRecordedVideoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [recorder.recordedBlob]);

  const showLiveVideo =
    !uploadedVideoUrl && !(recordedVideoUrl && recorder.state === 'complete');

  useEffect(() => {
    startCameraRef.current = recorder.startCamera;
  }, [recorder.startCamera]);

  useEffect(() => {
    if (!showLiveVideo) {
      return;
    }
    if (!videoRef.current) {
      return;
    }
    void startCameraRef.current();
  }, [showLiveVideo]);

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
    stopPoseAnalysis();
    clearGaitEvents();

    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }
    if (recordedVideoUrl) {
      setRecordedVideoUrl(null);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedVideoUrl(objectUrl);
    setUploadedVideoBlob(file);
    setVideoBlob(file);
    setPoseFrames([]);
    poseFramesRef.current = [];
    setPoseFramesInSession([]);
    setLatestPoseFrame(null);
    setLiveMetrics(EMPTY_LIVE_METRICS);
    setDetectedEvents(0);
    poseMetricsBufferRef.current = [];
    lastPoseTimestampRef.current = null;
    poseFpsRef.current = null;

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

  const hasScaleCalibration =
    (captureSettings.frameGroundWidthMeters != null && Number.isFinite(captureSettings.frameGroundWidthMeters)) ||
    (captureSettings.pxPerMeter != null && Number.isFinite(captureSettings.pxPerMeter));
  const manualHeightCm = patient?.height ?? null;
  const showHeightOverlay =
    showLiveVideo &&
    autoDetectionEnabled &&
    (recorder.state === 'recording' || liveMetrics.estimatedHeightCm != null || manualHeightCm != null);
  const formatNumber = (value: number | null, digits = 1): string =>
    value != null && Number.isFinite(value) ? value.toFixed(digits) : '—';
  const formatPercent = (value: number | null): string =>
    value != null && Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';

  return (
    <div className="page">
      <span className="step-indicator">Paso 3 · Captura</span>
      <header className="page-header">
        <h1>Graba la marcha</h1>
        <p>
          Coloca a la persona a 3 metros del móvil. Al grabar verás la altura en tiempo real sobre el video
          {manualHeightCm != null ? ` (registrada: ${manualHeightCm} cm).` : '.'}
        </p>
      </header>

      <section className="card video-shell">
        <div className="video-stage" style={{ display: showLiveVideo ? 'block' : 'none' }}>
          <video ref={videoRef} playsInline muted autoPlay />
          <PoseOverlay
            mode="live"
            videoRef={videoRef}
            liveFrame={latestPoseFrame}
            visible={showLiveVideo && showSkeleton && autoDetectionEnabled}
          />
          {showHeightOverlay && (
            <LiveHeightOverlay
              manualHeightCm={manualHeightCm}
              liveHeightCm={liveMetrics.estimatedHeightCm}
              heightConfidence={liveMetrics.heightConfidence}
              isRecording={recorder.state === 'recording'}
              hasScaleCalibration={hasScaleCalibration}
            />
          )}
        </div>
        <div className="video-stage" style={{ display: showLiveVideo ? 'none' : 'block' }}>
          <video
            ref={playbackVideoRef}
            playsInline
            controls
            src={uploadedVideoUrl ?? recordedVideoUrl ?? undefined}
          />
          <PoseOverlay
            mode="playback"
            videoRef={playbackVideoRef}
            frames={poseFrames}
            visible={!showLiveVideo && showSkeleton && poseFrames.length > 0}
          />
        </div>
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
          {recorder.state !== 'recording' && recorder.state !== 'complete' && (
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
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                setRecordedVideoUrl(null);
                setPoseFrames([]);
                poseFramesRef.current = [];
                setPoseFramesInSession([]);
                setLatestPoseFrame(null);
                setLiveMetrics(EMPTY_LIVE_METRICS);
                setDetectedEvents(0);
                poseMetricsBufferRef.current = [];
                lastPoseTimestampRef.current = null;
                poseFpsRef.current = null;
                clearGaitEvents();
                await recorder.resetRecording();
              }}
            >
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

        {showLiveVideo && autoDetectionEnabled && (
          <p className="helper-text" style={{ color: '#0f172a', fontWeight: 500 }}>
            {manualHeightCm != null && (
              <>Estatura registrada: {formatNumber(manualHeightCm, 1)} cm · </>
            )}
            Rodilla I/D: {formatNumber(liveMetrics.leftKneeAngle, 0)}° / {formatNumber(liveMetrics.rightKneeAngle, 0)}°
            {' · '}Cadera I/D: {formatNumber(liveMetrics.leftHipAngle, 0)}° / {formatNumber(liveMetrics.rightHipAngle, 0)}°
            {' · '}Confianza pose: {formatPercent(liveMetrics.poseConfidence)}
            {' · '}FPS pose: {formatNumber(liveMetrics.poseFps, 0)}
          </p>
        )}

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
