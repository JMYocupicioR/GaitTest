import { useRef, useCallback, useEffect } from 'react';
import { PoseGaitAnalyzer } from '../lib/poseEstimation.ts';
import type { HeelStrikeEvent, PoseFrame } from '../lib/poseEstimation.ts';

export interface UsePoseEstimationOptions {
  onHeelStrike?: (event: HeelStrikeEvent) => void;
  onPoseDetected?: (frame: PoseFrame) => void;
  autoStart?: boolean;
  /** Tiempo en segundos alineado con el video / grabación (prioridad sobre reloj del sistema). */
  getFrameTimestampSeconds?: () => number | null;
}

export const usePoseEstimation = (options: UsePoseEstimationOptions = {}) => {
  const analyzerRef = useRef<PoseGaitAnalyzer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isInitializedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const workerUnsupportedRef = useRef(false);
  const getTsRef = useRef(options.getFrameTimestampSeconds);
  getTsRef.current = options.getFrameTimestampSeconds;
  const onHeelRef = useRef(options.onHeelStrike);
  onHeelRef.current = options.onHeelStrike;
  const onPoseRef = useRef(options.onPoseDetected);
  onPoseRef.current = options.onPoseDetected;

  const initialize = useCallback(async (videoElement: HTMLVideoElement) => {
    if (isInitializedRef.current && analyzerRef.current) {
      analyzerRef.current.setLiveVideoElement(videoElement);
      videoRef.current = videoElement;
      return;
    }

    function wireCallbacks(analyzer: PoseGaitAnalyzer): void {
      analyzer.setLiveTimestampProvider(() => {
        const fn = getTsRef.current;
        const t = fn?.();
        return t != null && Number.isFinite(t) ? t : null;
      });
      analyzer.setHeelStrikeCallback((e) => {
        onHeelRef.current?.(e);
      });
      analyzer.setPoseCallback((f) => {
        onPoseRef.current?.(f);
      });
    }

    try {
      if (!workerRef.current && !workerUnsupportedRef.current && typeof Worker !== 'undefined') {
        try {
          const worker = new Worker(new URL('../workers/livePose.worker.ts', import.meta.url), {
            type: 'module',
          });
          worker.onmessage = (event: MessageEvent<{ type?: string }>) => {
            if (event.data?.type === 'unsupported') {
              workerUnsupportedRef.current = true;
              worker.terminate();
              workerRef.current = null;
            }
          };
          worker.postMessage({ type: 'init' });
          workerRef.current = worker;
        } catch {
          workerUnsupportedRef.current = true;
        }
      }

      analyzerRef.current = new PoseGaitAnalyzer();
      wireCallbacks(analyzerRef.current);
      analyzerRef.current.setLiveVideoElement(videoElement);
      videoRef.current = videoElement;
      isInitializedRef.current = true;

      if (options.autoStart) {
        analyzerRef.current.startAnalysis();
      }
    } catch (error) {
      console.error('Failed to initialize pose estimation:', error);
      throw error;
    }
  }, [options.autoStart]);

  const startAnalysis = useCallback(() => {
    if (analyzerRef.current && isInitializedRef.current) {
      analyzerRef.current.setLiveVideoElement(videoRef.current);
      analyzerRef.current.startAnalysis();
    }
  }, []);

  const stopAnalysis = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.stopAnalysis();
    }
  }, []);

  const getJointTrajectories = useCallback(() => {
    if (analyzerRef.current) {
      return analyzerRef.current.getJointTrajectories();
    }
    return null;
  }, []);

  const calculateJointAngles = useCallback((frame: PoseFrame) => {
    if (analyzerRef.current) {
      return analyzerRef.current.calculateJointAngles(frame);
    }
    return null;
  }, []);

  const cleanup = useCallback(() => {
    const analyzer = analyzerRef.current;
    if (analyzer) {
      void analyzer.dispose().catch((error) => {
        console.warn('Pose analyzer dispose failed:', error);
      });
    }
    analyzerRef.current = null;
    videoRef.current = null;
    isInitializedRef.current = false;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    initialize,
    startAnalysis,
    stopAnalysis,
    getJointTrajectories,
    calculateJointAngles,
    cleanup,
    isInitialized: isInitializedRef.current,
    analyzer: analyzerRef.current
  };
};