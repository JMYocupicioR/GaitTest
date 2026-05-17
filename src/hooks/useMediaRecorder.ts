import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type RecorderState = 'idle' | 'preview' | 'recording' | 'complete';

function describeGetUserMediaError(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'La cámara solo funciona en HTTPS (o en localhost). Abre la URL https:// que muestra Vite al hacer npm run dev y acepta el aviso del certificado en el móvil.';
  }
  const e = err as DOMException | undefined;
  if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
    return 'Permiso de cámara denegado. Permítelo en los ajustes del sitio del navegador.';
  }
  if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
    return 'No se encontró ninguna cámara en este dispositivo.';
  }
  if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
    return 'La cámara está en uso por otra aplicación. Ciérrala e inténtalo de nuevo.';
  }
  return 'No pudimos acceder a la cámara. Revisa permisos y vuelve a intentar.';
}

interface UseMediaRecorderOptions {
  targetFps: number;
  videoRef: RefObject<HTMLVideoElement | null>;
}

interface UseMediaRecorderResult {
  state: RecorderState;
  error: string | null;
  startCamera: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  stopCamera: () => void;
  /** Limpia la grabación previa para volver al estado de previsualización en directo. */
  resetRecording: () => Promise<void>;
  recordedBlob: Blob | null;
  durationSeconds: number | null;
  fpsDetected: number | null;
  /** Segundos desde startRecording (solo fiable durante state === 'recording'). */
  getRecordingElapsedSeconds: () => number | null;
}

export const useMediaRecorder = ({ targetFps, videoRef }: UseMediaRecorderOptions): UseMediaRecorderResult => {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [fpsDetected, setFpsDetected] = useState<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const stopTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const attachStreamToVideo = useCallback(async (stream: MediaStream) => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    try {
      if (el.paused) {
        await el.play();
      }
    } catch (err) {
      console.warn('No se pudo reproducir la previsualización en directo:', err);
    }
  }, [videoRef]);

  const startCamera = useCallback(async () => {
    const existingTrack = mediaStreamRef.current?.getVideoTracks()[0];
    if (existingTrack && existingTrack.readyState === 'live' && mediaStreamRef.current) {
      setError(null);
      await attachStreamToVideo(mediaStreamRef.current);
      setState('preview');
      return;
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: targetFps, max: targetFps },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      if (settings.frameRate) {
        setFpsDetected(typeof settings.frameRate === 'number' ? settings.frameRate : Number(settings.frameRate));
      }
      await attachStreamToVideo(stream);
      if (track.readyState === 'live') {
        setError(null);
      }
      setState('preview');
    } catch (err) {
      const liveTrack = mediaStreamRef.current?.getVideoTracks()[0];
      if (liveTrack && liveTrack.readyState === 'live') {
        console.warn('Camera re-acquisition failed but existing stream is live, ignoring:', err);
        return;
      }
      setError(describeGetUserMediaError(err));
      console.error(err);
    }
  }, [attachStreamToVideo, targetFps]);

  const startRecording = useCallback(async () => {
    if (!mediaStreamRef.current) {
      await startCamera();
    }
    const stream = mediaStreamRef.current;
    if (!stream) {
      setError(
        typeof window !== 'undefined' && !window.isSecureContext
          ? 'La cámara requiere HTTPS al abrir desde la IP de la red. Usa https://TU_IP:5173 (npm run dev) y acepta el certificado.'
          : 'No se detectó la cámara. Revisa permisos o usa “Cargar video”.',
      );
      return;
    }

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        setRecordedBlob(blob);
        if (startTimeRef.current !== null) {
          setDurationSeconds((Date.now() - startTimeRef.current) / 1000);
        }
        setState('complete');
      };
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setDurationSeconds(null);
      setRecordedBlob(null);
      setState('recording');
    } catch (err) {
      setError('No se pudo iniciar la grabación.');
      console.error(err);
    }
  }, [startCamera]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    recorderRef.current = null;
    // No tocamos videoRef.current: el componente se encargará de mostrar el clip grabado.
  }, []);

  const stopCamera = useCallback(() => {
    stopTracks();
    setState('idle');
  }, [stopTracks]);

  const resetRecording = useCallback(async () => {
    setRecordedBlob(null);
    setDurationSeconds(null);
    startTimeRef.current = null;
    setState('preview');
    const stream = mediaStreamRef.current;
    const liveTrack = stream?.getVideoTracks()[0];
    if (!stream || !liveTrack || liveTrack.readyState !== 'live') {
      await startCamera();
      return;
    }
    // Si el <video> en directo aún no está montado, el efecto de CaptureScreen
    // llamará a startCamera() y la asociación se completará entonces.
    await attachStreamToVideo(stream);
  }, [attachStreamToVideo, startCamera]);

  useEffect(() => () => {
    stopTracks();
  }, [stopTracks]);

  const getRecordingElapsedSeconds = useCallback((): number | null => {
    if (state !== 'recording' || startTimeRef.current === null) {
      return null;
    }
    return Math.max(0, (Date.now() - startTimeRef.current) / 1000);
  }, [state]);

  return {
    state,
    error,
    startCamera,
    startRecording,
    stopRecording,
    stopCamera,
    resetRecording,
    recordedBlob,
    durationSeconds,
    fpsDetected,
    getRecordingElapsedSeconds,
  };
};
