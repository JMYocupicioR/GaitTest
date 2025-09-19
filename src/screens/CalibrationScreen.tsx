import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';

const calibrationOptions = [
  { id: 'line', label: 'Línea de 5 metros (recomendada)' },
  { id: 'object', label: 'Objeto de referencia (tarjeta, hoja A4)', disabled: true },
];

export const CalibrationScreen = () => {
  const navigate = useNavigate();
  const captureSettings = useSessionStore((state) => state.session.captureSettings);
  const setCaptureSettings = useSessionStore((state) => state.setCaptureSettings);
  const [distanceMeters, setDistanceMeters] = useState<number>(captureSettings.distanceMeters ?? 5);
  const [calibrationType, setCalibrationType] = useState<string>(captureSettings.calibrationType);
  const [targetFps, setTargetFps] = useState<number>(captureSettings.targetFps ?? 60);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!calibrationConfirmed) {
      return;
    }
    setCaptureSettings({
      distanceMeters,
      calibrationType: calibrationType as typeof captureSettings.calibrationType,
      targetFps,
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

      <section className="card">
        <div className="form-section">
          <label>Tipo de calibración</label>
          <div className="button-row">
            {calibrationOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`secondary-button${calibrationType === option.id ? ' selected' : ''}`}
                onClick={() => !option.disabled && setCalibrationType(option.id)}
                disabled={option.disabled}
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

      <section className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div className="form-section">
          <label htmlFor="distance">Distancia recorrida (m)</label>
          <input
            id="distance"
            type="number"
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

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={calibrationConfirmed}
            onChange={(event) => setCalibrationConfirmed(event.target.checked)}
          />
          <span>He marcado la distancia en el suelo y cuento con espacio libre para caminar.</span>
        </label>
      </section>

      <div className="button-row">
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
