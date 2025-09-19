import { useRef, useCallback, useEffect } from 'react';
import { PoseGaitAnalyzer } from '../lib/poseEstimation.ts';
import type { HeelStrikeEvent, PoseFrame } from '../lib/poseEstimation.ts';

export interface UsePoseEstimationOptions {
  onHeelStrike?: (event: HeelStrikeEvent) => void;
  onPoseDetected?: (frame: PoseFrame) => void;
  autoStart?: boolean;
}

export const usePoseEstimation = (options: UsePoseEstimationOptions = {}) => {
  const analyzerRef = useRef<PoseGaitAnalyzer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isInitializedRef = useRef(false);

  const initialize = useCallback(async (videoElement: HTMLVideoElement) => {
    if (isInitializedRef.current) return;

    try {
      analyzerRef.current = new PoseGaitAnalyzer();

      if (options.onHeelStrike) {
        analyzerRef.current.setHeelStrikeCallback(options.onHeelStrike);
      }

      if (options.onPoseDetected) {
        analyzerRef.current.setPoseCallback(options.onPoseDetected);
      }

      await analyzerRef.current.initializeCamera(videoElement);
      videoRef.current = videoElement;
      isInitializedRef.current = true;

      if (options.autoStart) {
        analyzerRef.current.startAnalysis();
      }
    } catch (error) {
      console.error('Failed to initialize pose estimation:', error);
      throw error;
    }
  }, [options.onHeelStrike, options.onPoseDetected, options.autoStart]);

  const startAnalysis = useCallback(() => {
    if (analyzerRef.current && isInitializedRef.current) {
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
    if (analyzerRef.current) {
      analyzerRef.current.stopAnalysis();
    }
    analyzerRef.current = null;
    videoRef.current = null;
    isInitializedRef.current = false;
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