import type { CaptureQuality, QualityLevel } from '../types/session.ts';

interface QualityInput {
  durationSeconds: number | null;
  fpsDetected: number | null;
  lightingScore: QualityLevel;
  calibrationConfirmed: boolean;
  subjectCentered: boolean;
}

export const assessQuality = ({
  durationSeconds,
  fpsDetected,
  lightingScore,
  calibrationConfirmed,
  subjectCentered,
}: QualityInput): CaptureQuality => {
  const issues: string[] = [];

  if (!durationSeconds || durationSeconds < 6) {
    issues.push('clip corto (<6 s)');
  }

  if (!fpsDetected || fpsDetected < 24) {
    issues.push('fps bajos');
  }

  if (!calibrationConfirmed) {
    issues.push('calibración sin confirmar');
  }

  if (!subjectCentered) {
    issues.push('sujeto fuera de cuadro en parte del clip');
  }

  if (lightingScore === 'low') {
    issues.push('iluminación insuficiente');
  }

  let confidence: QualityLevel = 'high';
  if (issues.length >= 3) {
    confidence = 'low';
  } else if (issues.length > 0 || lightingScore === 'medium') {
    confidence = 'medium';
  }

  return {
    fpsDetected,
    lightingScore,
    issues,
    confidence,
    durationSeconds,
  };
};
