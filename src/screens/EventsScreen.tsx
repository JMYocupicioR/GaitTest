import type { ObservationChecklist } from '../types/session.ts';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';
import { formatSeconds } from '../lib/format.ts';

const observationFields = [
  { id: 'limitedStepLength', label: 'Longitud de paso visiblemente reducida contralateral' },
  { id: 'lateralTrunkLean', label: 'Balanceo lateral pronunciado del tronco' },
  { id: 'circumduction', label: 'Circunducción / elevación excesiva en balanceo' },
  { id: 'forefootInitialContact', label: 'Contacto inicial con antepié o pie caído' },
  { id: 'highCadenceShortSteps', label: 'Pasos cortos con cadencia alta y braceo reducido' },
  { id: 'wideBase', label: 'Base de apoyo amplia con inestabilidad' },
  { id: 'irregularTiming', label: 'Variabilidad marcada entre intervalos de pasos' },
] as const;

type ObservationId = (typeof observationFields)[number]['id'];

export const EventsScreen = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const session = useSessionStore((state) => state.session);
  const addHeelStrike = useSessionStore((state) => state.addHeelStrike);
  const updateEvent = useSessionStore((state) => state.updateEvent);
  const removeEvent = useSessionStore((state) => state.removeEvent);
  const setObservations = useSessionStore((state) => state.setObservations);
  const finalizeAnalysis = useSessionStore((state) => state.finalizeAnalysis);

  const videoUrl = useMemo(() => {
    if (!session.videoBlob) {
      return null;
    }
    return URL.createObjectURL(session.videoBlob);
  }, [session.videoBlob]);

  useEffect(() => () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
  }, [videoUrl]);

  const handleAddEvent = (foot: 'L' | 'R') => {
    if (!videoRef.current) {
      addHeelStrike(foot, 0);
      return;
    }
    addHeelStrike(foot, Number(videoRef.current.currentTime.toFixed(2)));
  };

  const handleTimeChange = (eventId: string, value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return;
    }
    updateEvent(eventId, { timestamp: numeric });
  };

  const handleToggleObservation = (id: ObservationId) => (event: ChangeEvent<HTMLInputElement>) => {
    const update: Partial<ObservationChecklist> = { [id]: event.target.checked } as Partial<ObservationChecklist>;
    setObservations(update);
  };

  const canContinue = session.events.length >= 4;

  const handleContinue = () => {
    finalizeAnalysis();
    navigate('/results');
  };

  return (
    <div className="page">
      <span className="step-indicator">Paso 4 · Revisión</span>
      <header className="page-header">
        <h1>Anota eventos clave</h1>
        <p>Revisa el clip y marca los golpes de talón. Puedes ajustar los tiempos manualmente si es necesario.</p>
      </header>

      <section className="card video-shell">
        {videoUrl ? (
          <video ref={videoRef} controls src={videoUrl} playsInline />
        ) : (
          <p className="helper-text">Todavía no hay video cargado. Vuelve a la cámara para grabar.</p>
        )}
        <div className="button-row">
          <button type="button" className="primary-button" disabled={!videoUrl} onClick={() => handleAddEvent('L')}>
            + Talón Izquierdo
          </button>
          <button type="button" className="primary-button" disabled={!videoUrl} onClick={() => handleAddEvent('R')}>
            + Talón Derecho
          </button>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Eventos detectados ({session.events.length})</h2>
        {session.events.length === 0 ? (
          <p className="helper-text">Marca al menos dos eventos por pierna para habilitar el análisis.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {session.events.map((event) => (
              <div key={event.id} className="form-section" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '4rem', fontWeight: 600 }}>{event.foot === 'L' ? 'Izq.' : 'Der.'}</span>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={event.timestamp}
                  onChange={(changeEvent) => handleTimeChange(event.id, changeEvent.target.value)}
                  style={{ maxWidth: '8rem' }}
                />
                <span className="helper-text">{formatSeconds(event.timestamp)}</span>
                <button type="button" className="secondary-button" onClick={() => removeEvent(event.id)}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Checklist observacional</h2>
        <div className="checkbox-grid">
          {observationFields.map((item) => (
            <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={Boolean(session.observations[item.id])}
                onChange={handleToggleObservation(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
          Volver
        </button>
        <button type="button" className="primary-button" disabled={!canContinue} onClick={handleContinue}>
          Ver resultados
        </button>
      </div>
    </div>
  );
};
