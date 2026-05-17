import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';
import { CalibrationCanvas } from '../components/CalibrationCanvas.tsx';

const calibrationOptions = [
  { id: 'line', label: 'Línea de 5 metros (recomendada)' },
  { id: 'object', label: 'Objeto de referencia (tarjeta, hoja A4)' },
  { id: 'manual', label: 'Dos clics manuales (avanzada)' },
];

export const CalibrationScreen = () => {
  const navigate = useNavigate();
  const patient = useSessionStore((state) => state.session.patient);
  const captureSettings = useSessionStore((state) => state.session.captureSettings);
  const setCaptureSettings = useSessionStore((state) => state.setCaptureSettings);
  const [distanceMeters, setDistanceMeters] = useState<number>(captureSettings.distanceMeters ?? 5);
  const [calibrationType, setCalibrationType] = useState<string>(captureSettings.calibrationType);
  const [targetFps, setTargetFps] = useState<number>(captureSettings.targetFps ?? 60);
  const [frameGroundWidthMeters, setFrameGroundWidthMeters] = useState<string>(
    captureSettings.frameGroundWidthMeters != null ? String(captureSettings.frameGroundWidthMeters) : '',
  );
  const [manualDistanceMeters, setManualDistanceMeters] = useState(1);
  const [calibrationImageUrl, setCalibrationImageUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pxPerMeter, setPxPerMeter] = useState<number | null>(captureSettings.pxPerMeter ?? null);
  const [calibrationMethod, setCalibrationMethod] = useState<
    'line_distance' | 'manual_click' | 'auto_object' | null
  >(captureSettings.calibrationMethod ?? null);
  const [calibrationConfidence, setCalibrationConfidence] = useState<number | null>(captureSettings.calibrationConfidence ?? null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => () => {
    closeCamera();
    if (calibrationImageUrl) {
      URL.revokeObjectURL(calibrationImageUrl);
    }
  }, [calibrationImageUrl]);

  const openCameraForReference = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);
    } catch (error) {
      console.error('No se pudo abrir la cámara para calibración:', error);
    }
  };

  const captureReferenceFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) return;
    if (calibrationImageUrl) {
      URL.revokeObjectURL(calibrationImageUrl);
    }
    setCalibrationImageUrl(URL.createObjectURL(blob));
    closeCamera();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!calibrationConfirmed) {
      return;
    }
    const groundW = frameGroundWidthMeters.trim() === '' ? null : Number(frameGroundWidthMeters);
    setCaptureSettings({
      distanceMeters,
      calibrationType: calibrationType as typeof captureSettings.calibrationType,
      targetFps,
      frameGroundWidthMeters:
        groundW != null && Number.isFinite(groundW) && groundW > 0 ? groundW : null,
      pxPerMeter: pxPerMeter ?? null,
      calibrationMethod: calibrationMethod ?? 'line_distance',
      calibrationConfidence: calibrationConfidence ?? null,
    });
    navigate('/capture', { state: { calibrationConfirmed: true } });
  };

  return (
    <form className="page" onSubmit={handleSubmit}>
      <span className="step-indicator">Paso 2 · Calibración</span>
      <header className="page-header">
        <h1>Define tu referencia</h1>
        <p>Usa la línea de 5 metros para traducir la velocidad real. Más adelante añadiremos opciones con objetos.</p>
      </header>

      {patient?.height != null && (
        <section className="card patient-summary-card" aria-label="Resumen del paciente">
          <h2>Paciente</h2>
          <p className="helper-text" style={{ margin: 0 }}>
            {patient.name ? `${patient.name} · ` : ''}
            Estatura {patient.height} cm
            {patient.weight != null ? ` · Peso ${patient.weight} kg` : ''}
            {patient.age != null ? ` · ${patient.age} años` : ''}
          </p>
        </section>
      )}

      <section className="card">
        <div className="form-section">
          <label>Tipo de calibración</label>
          <div className="button-row button-row--stack-mobile">
            {calibrationOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`secondary-button${calibrationType === option.id ? ' selected' : ''}`}
                onClick={() => setCalibrationType(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {calibrationType === 'line' && (
            <p className="helper-text">
              Marca claramente los 5 metros en el suelo (cinta adhesiva o líneas visibles). Debes cruzar toda la línea durante el clip.
            </p>
          )}
        </div>
      </section>

      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Calibración visual (opcional pero recomendada)</h2>
        <p className="helper-text">
          Captura un frame de referencia y calibra por objeto (A4/tarjeta) o por 2 clics manuales.
        </p>
        <div className="button-row">
          {!cameraOpen ? (
            <button type="button" className="secondary-button" onClick={() => void openCameraForReference()}>
              Capturar referencia
            </button>
          ) : (
            <>
              <button type="button" className="primary-button" onClick={() => void captureReferenceFrame()}>
                Tomar foto
              </button>
              <button type="button" className="secondary-button" onClick={closeCamera}>
                Cerrar cámara
              </button>
            </>
          )}
        </div>
        {cameraOpen && <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: '0.75rem' }} />}
        {(calibrationType === 'object' || calibrationType === 'manual') && calibrationImageUrl && (
          <>
            {calibrationType === 'manual' && (
              <div className="form-section">
                <label htmlFor="manualDistance">Distancia real entre los 2 puntos (m)</label>
                <input
                  id="manualDistance"
                  type="number"
                  inputMode="decimal"
                  min={0.05}
                  step={0.01}
                  value={manualDistanceMeters}
                  onChange={(event) => setManualDistanceMeters(Number(event.target.value))}
                />
              </div>
            )}
            <CalibrationCanvas
              imageUrl={calibrationImageUrl}
              mode={calibrationType === 'object' ? 'auto' : 'manual'}
              manualDistanceMeters={manualDistanceMeters}
              onAutoDetected={(result) => {
                if (!result) {
                  setPxPerMeter(null);
                  setCalibrationMethod(null);
                  setCalibrationConfidence(null);
                  return;
                }
                setPxPerMeter(result.pxPerMeter);
                setCalibrationMethod('auto_object');
                setCalibrationConfidence(result.confidence);
              }}
              onManualMeasured={(value) => {
                setPxPerMeter(value);
                setCalibrationMethod(value ? 'manual_click' : null);
                setCalibrationConfidence(value ? 0.95 : null);
              }}
            />
          </>
        )}
        <p className="helper-text">
          Resumen: {pxPerMeter ? `1 m = ${pxPerMeter.toFixed(1)} px` : 'sin escala visual'} ·
          Método: {calibrationMethod ?? 'line_distance'} ·
          Confianza: {calibrationConfidence != null ? `${Math.round(calibrationConfidence * 100)}%` : 'N/A'}
        </p>
      </section>

      <section className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div className="form-section">
          <label htmlFor="distance">Distancia recorrida (m)</label>
          <input
            id="distance"
            type="number"
            inputMode="decimal"
            min={3}
            max={15}
            step={0.5}
            value={distanceMeters}
            onChange={(event) => setDistanceMeters(Number(event.target.value))}
          />
          <p className="helper-text">
            Ajusta en función del espacio disponible, pero intenta mantener al menos 5 metros para estimar velocidad con precisión.
          </p>
        </div>

        <div className="form-section">
          <label htmlFor="fps">FPS objetivo</label>
          <select id="fps" value={targetFps} onChange={(event) => setTargetFps(Number(event.target.value))}>
            <option value={60}>60 fps (ideal)</option>
            <option value={30}>30 fps</option>
            <option value={24}>24 fps</option>
          </select>
          <p className="helper-text">La app detectará el FPS real del clip tras grabar y ajustará la confianza.</p>
        </div>

        <div className="form-section">
          <label htmlFor="groundWidth">Ancho del suelo visible en el encuadre (m, opcional)</label>
          <input
            id="groundWidth"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={8}
            step={0.1}
            placeholder="p. ej. 2.0 — dejar vacío para heurística por defecto"
            value={frameGroundWidthMeters}
            onChange={(event) => setFrameGroundWidthMeters(event.target.value)}
          />
          <p className="helper-text">
            Mide aproximadamente cuántos metros del suelo entran de lado a lado en la imagen. Mejora el ancho de paso y
            métricas espaciales derivadas de la pose; si lo omites se usa una estimación fija (~1,8 m).
          </p>
        </div>

        <label className="touch-checkbox-label">
          <input
            type="checkbox"
            checked={calibrationConfirmed}
            onChange={(event) => setCalibrationConfirmed(event.target.checked)}
          />
          <span>He marcado la distancia en el suelo y cuento con espacio libre para caminar.</span>
        </label>
      </section>

      <div className="button-row page-actions">
        <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
          Volver
        </button>
        <button type="submit" className="primary-button" disabled={!calibrationConfirmed}>
          Ir a la cámara
        </button>
      </div>
    </form>
  );
};
