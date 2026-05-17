interface LiveHeightOverlayProps {
  manualHeightCm: number | null;
  liveHeightCm: number | null;
  heightConfidence: number | null;
  isRecording: boolean;
  hasScaleCalibration: boolean;
}

function formatCm(value: number | null): string {
  return value != null && Number.isFinite(value) ? `${value.toFixed(1)} cm` : '—';
}

function formatConfidence(value: number | null): string {
  return value != null && Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
}

export function LiveHeightOverlay({
  manualHeightCm,
  liveHeightCm,
  heightConfidence,
  isRecording,
  hasScaleCalibration,
}: LiveHeightOverlayProps) {
  const displayHeight = liveHeightCm ?? manualHeightCm;
  const showLiveEstimate = liveHeightCm != null && manualHeightCm != null
    && Math.abs(liveHeightCm - manualHeightCm) > 0.5;

  return (
    <div
      className="live-height-overlay"
      data-recording={isRecording ? 'true' : 'false'}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="live-height-overlay__primary">
        <span className="live-height-overlay__label">
          {isRecording ? 'Altura en vivo' : 'Altura'}
        </span>
        <span className="live-height-overlay__value">{formatCm(displayHeight)}</span>
        {isRecording && (
          <span className="live-height-overlay__pulse" aria-hidden="true" />
        )}
      </div>
      {manualHeightCm != null && (
        <p className="live-height-overlay__meta">
          Registrada: {formatCm(manualHeightCm)}
          {showLiveEstimate && ` · Estimada: ${formatCm(liveHeightCm)}`}
        </p>
      )}
      {liveHeightCm != null && manualHeightCm == null && (
        <p className="live-height-overlay__meta">
          Estimada por pose
          {!hasScaleCalibration && ' · Calibra escena para mayor precisión'}
        </p>
      )}
      {liveHeightCm != null && (
        <p className="live-height-overlay__meta">
          Confianza: {formatConfidence(heightConfidence)}
        </p>
      )}
    </div>
  );
}
