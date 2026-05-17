# Integración FreeMoCap -> GaitTest

Este documento mapea la lógica clave de FreeMoCap al sistema GaitTest.

## 1) Post-procesamiento

- FreeMoCap: interpolación + Butterworth + rigid bones
- GaitTest:
  - `src/lib/poseInterpolation.ts`
  - `src/lib/signalProcessing.ts`
  - `src/lib/rigidBones.ts`
  - `src/lib/postProcessSkeleton.ts`

## 2) Anatomía y centro de masa

- FreeMoCap: COM segmentario y COM total con antropometría
- GaitTest:
  - `src/lib/centerOfMass.ts`
  - `src/types/session.ts` (`MEDIAPIPE_SEGMENTS_WINTER`)

## 3) Pipeline de análisis

- FreeMoCap: `process_recording_folder` orquesta el pipeline
- GaitTest:
  - `src/lib/enhancedAnalysis.ts` ahora integra `postProcessPoseFrames()`
  - `src/lib/advancedMetrics.ts` usa COM antropométrico cuando está disponible

## 4) Calidad de landmarks

- FreeMoCap: error de reproyección por punto/cámara
- GaitTest:
  - `ProcessedSkeleton.landmarkQualityScores`
  - `ProcessedSkeleton.frameQualityScores`

## 5) Exportación clínica

- FreeMoCap: foco en .npy y exportes de ecosistema
- GaitTest:
  - `src/lib/exporters/trcWriter.ts`
  - `src/lib/exporters/motWriter.ts`
  - `services/c3d-exporter/` (FastAPI + ezc3d)
  - `supabase/functions/export-c3d/index.ts`
