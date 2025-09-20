import { useState, useEffect, useCallback } from 'react';
import type { PoseFrame } from '../lib/poseEstimation.ts';
import type { SessionData, KinematicSummary, DetailedKinematics } from '../types/session.ts';
import { kinematicExtractor, type ExtractedKinematicValues } from '../lib/kinematicExtractor.ts';

interface KinematicAnalysisState {
  isProcessing: boolean;
  kinematicSummary: KinematicSummary | null;
  detailedKinematics: DetailedKinematics | null;
  extractedValues: ExtractedKinematicValues | null;
  frameCount: number;
  lastProcessedTime: number;
  error: string | null;
}

interface UseKinematicAnalysisResult {
  state: KinematicAnalysisState;
  processFrame: (frame: PoseFrame) => void;
  processFrameBuffer: (frames: PoseFrame[]) => void;
  extractSessionValues: (sessionData: SessionData) => ExtractedKinematicValues;
  generateReport: () => string | null;
  clearAnalysis: () => void;
  isReady: boolean;
}

export function useKinematicAnalysis(): UseKinematicAnalysisResult {
  const [state, setState] = useState<KinematicAnalysisState>({
    isProcessing: false,
    kinematicSummary: null,
    detailedKinematics: null,
    extractedValues: null,
    frameCount: 0,
    lastProcessedTime: 0,
    error: null
  });

  const [frameBuffer, setFrameBuffer] = useState<PoseFrame[]>([]);

  // Procesar frames en tiempo real (throttled)
  const processFrame = useCallback((frame: PoseFrame) => {
    const now = performance.now();

    // Throttle processing to avoid overload
    if (now - state.lastProcessedTime < 100) { // Max 10 FPS processing
      return;
    }

    setFrameBuffer(prev => {
      const newBuffer = [...prev, frame];

      // Keep only last 60 frames (6 seconds at 10 FPS)
      if (newBuffer.length > 60) {
        newBuffer.shift();
      }

      return newBuffer;
    });

    setState(prev => ({
      ...prev,
      frameCount: prev.frameCount + 1,
      lastProcessedTime: now
    }));
  }, [state.lastProcessedTime]);

  // Procesar buffer completo de frames
  const processFrameBuffer = useCallback(async (frames: PoseFrame[]) => {
    if (frames.length < 10) {
      setState(prev => ({
        ...prev,
        error: 'Se necesitan al menos 10 frames para análisis cinemático'
      }));
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      // Procesar análisis cinemático detallado
      const detailedKinematics = kinematicExtractor.processFramesForKinematics(frames);

      if (!detailedKinematics) {
        throw new Error('No se pudo calcular la cinemática detallada');
      }

      // Generar resumen cinemático
      const kinematicSummary = kinematicExtractor.generateKinematicSummaryFromFrames(frames);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        detailedKinematics,
        kinematicSummary,
        error: null
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Error en análisis cinemático'
      }));
    }
  }, []);

  // Extraer valores para sesión completa
  const extractSessionValues = useCallback((sessionData: SessionData): ExtractedKinematicValues => {
    try {
      const extractedValues = kinematicExtractor.extractKinematicValues(sessionData);

      setState(prev => ({
        ...prev,
        extractedValues,
        error: null
      }));

      return extractedValues;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error extrayendo valores cinemáticos';
      setState(prev => ({
        ...prev,
        error: errorMsg
      }));

      // Return empty values on error
      return {
        left: {
          hip_flex_ic: null,
          hip_rot_mean: null,
          knee_flex_mean_stance: null,
          knee_flex_max_extension: null,
          ankle_dorsi_max: null,
          ankle_plantar_max: null
        },
        right: {
          hip_flex_ic: null,
          hip_rot_mean: null,
          knee_flex_mean_stance: null,
          knee_flex_max_extension: null,
          ankle_dorsi_max: null,
          ankle_plantar_max: null
        },
        speed_norm: null,
        step_len_norm: null,
        cadence_norm: null,
        leg_len: null
      };
    }
  }, []);

  // Generar reporte cinemático
  const generateReport = useCallback((): string | null => {
    if (!state.kinematicSummary) {
      return null;
    }

    try {
      // Usar el analizador para generar el reporte
      return kinematicExtractor['analyzer']?.generateKinematicReport(state.kinematicSummary) || null;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Error generando reporte cinemático'
      }));
      return null;
    }
  }, [state.kinematicSummary]);

  // Limpiar análisis
  const clearAnalysis = useCallback(() => {
    setState({
      isProcessing: false,
      kinematicSummary: null,
      detailedKinematics: null,
      extractedValues: null,
      frameCount: 0,
      lastProcessedTime: 0,
      error: null
    });
    setFrameBuffer([]);
  }, []);

  // Auto-procesar buffer cuando se acumulan suficientes frames
  useEffect(() => {
    if (frameBuffer.length >= 30 && !state.isProcessing) {
      // Auto-proceso cada 30 frames para análisis en tiempo real
      processFrameBuffer(frameBuffer);
    }
  }, [frameBuffer.length, state.isProcessing, processFrameBuffer]);

  // Indicar si el sistema está listo para análisis
  const isReady = frameBuffer.length >= 10 && !state.isProcessing;

  return {
    state,
    processFrame,
    processFrameBuffer,
    extractSessionValues,
    generateReport,
    clearAnalysis,
    isReady
  };
}

// Hook específico para integración con sesiones
export function useSessionKinematicIntegration() {
  const kinematicAnalysis = useKinematicAnalysis();

  const enhanceSessionWithKinematics = useCallback(
    (sessionData: SessionData): SessionData => {
      const extractedValues = kinematicAnalysis.extractSessionValues(sessionData);

      // Enriquecer sessionData con análisis cinemático
      const enhancedSession: SessionData = {
        ...sessionData,
        enhancedAnalysisResult: {
          ...sessionData.enhancedAnalysisResult,
          kinematicSummary: kinematicAnalysis.state.kinematicSummary ?? undefined,
          kinematicValues: extractedValues
        }
      };

      return enhancedSession;
    },
    [kinematicAnalysis]
  );

  return {
    ...kinematicAnalysis,
    enhanceSessionWithKinematics
  };
}