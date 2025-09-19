import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type RecorderState = 'idle' | 'preview' | 'recording' | 'complete';

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
  recordedBlob: Blob | null;
  durationSeconds: number | null;
  fpsDetected: number | null;
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

  const startCamera = useCallback(async () => {
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('preview');
    } catch (err) {
      setError('No pudimos acceder a la cámara. Revisa permisos y vuelve a intentar.');
      console.error(err);
    }
  }, [targetFps, videoRef]);

  const startRecording = useCallback(async () => {
    if (!mediaStreamRef.current) {
      await startCamera();
    }
    const stream = mediaStreamRef.current;
    if (!stream) {
      setError('No se detectó la cámara.');
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
    if (videoRef.current) {
      await videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    stopTracks();
    setState('idle');
  }, [stopTracks]);

  useEffect(() => () => {
    stopTracks();
  }, [stopTracks]);

  return {
    state,
    error,
    startCamera,
    startRecording,
    stopRecording,
    stopCamera,
    recordedBlob,
    durationSeconds,
    fpsDetected,
  };
};
