import type { ObservationChecklist, OGSScore, OGSItemScore, FootSide } from '../types/session.ts';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';
import { formatSeconds } from '../lib/format.ts';
import { OGSInput } from '../components/OGSInput.tsx';
import { DEFAULT_OGS_SCORE } from '../types/session.ts';

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
  const setOGSScore = useSessionStore((state) => state.setOGSScore);
  const finalizeAnalysis = useSessionStore((state) => state.finalizeAnalysis);

  // Estado local para OGS
  const [ogsScores, setOgsScores] = useState<{
    left: OGSScore | null;
    right: OGSScore | null;
  }>({
    left: session.ogs?.leftScore || { ...DEFAULT_OGS_SCORE },
    right: session.ogs?.rightScore || { ...DEFAULT_OGS_SCORE },
  });

  const [showOGS, setShowOGS] = useState(false);

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

  const handleOGSChange = (foot: FootSide, item: keyof OGSScore, score: OGSItemScore | null) => {
    const footKey = foot === 'L' ? 'left' : 'right';
    setOgsScores(prev => ({
      ...prev,
      [footKey]: {
        ...prev[footKey],
        [item]: score,
      },
    }));
  };

  const canContinue = session.events.length >= 4;

  const handleContinue = () => {
    // Guardar puntuaciones OGS antes de continuar
    if (ogsScores.left && ogsScores.right) {
      setOGSScore(ogsScores.left, ogsScores.right);
    }
    finalizeAnalysis();
    navigate('/results');
  };

  return (
    <div className="page">
      <span className="step-indicator">Paso 4 · Revisión</span>
      <header className="page-header">
        <h1>Revisión y evaluación observacional</h1>
        <p>Revisa el clip, marca eventos clave y completa la evaluación observacional usando la Escala OGS.</p>
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

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Escala de Marcha Observacional (OGS)</h2>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowOGS(!showOGS)}
            style={{ fontSize: '0.9rem' }}
          >
            {showOGS ? 'Ocultar OGS' : 'Mostrar OGS'}
          </button>
        </div>

        {!showOGS && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px dashed #d1d5db',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', margin: 0 }}>
              Evaluación cualitativa opcional de 8 fases del ciclo de marcha por extremidad.
              <br />
              <span style={{ fontSize: '0.9rem' }}>
                Puntuación: -1 (muy alterado) a 3 (normal). Total máximo: 24 puntos por pierna.
              </span>
            </p>
          </div>
        )}

        {showOGS && (
          <>
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#eff6ff',
              borderRadius: '6px',
              border: '1px solid #bfdbfe'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af' }}>
                <strong>Instrucciones:</strong> Observa cada fase del ciclo de marcha y puntúa de -1 (muy alterado)
                a 3 (normal). La evaluación es más confiable para articulaciones distales (rodilla y tobillo).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <OGSInput
                foot="L"
                score={ogsScores.left}
                onChange={handleOGSChange}
              />
              <OGSInput
                foot="R"
                score={ogsScores.right}
                onChange={handleOGSChange}
              />
            </div>

            {ogsScores.left && ogsScores.right && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#15803d' }}>Resumen OGS:</span>
                    <span style={{ marginLeft: '0.5rem', color: '#374151' }}>
                      Izquierda: {Object.values(ogsScores.left).reduce((sum, score) => sum + (score ?? 0), 0)}/24
                    </span>
                    <span style={{ marginLeft: '1rem', color: '#374151' }}>
                      Derecha: {Object.values(ogsScores.right).reduce((sum, score) => sum + (score ?? 0), 0)}/24
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Completado: {
                      Math.round((
                        (Object.values(ogsScores.left).filter(s => s !== null).length +
                         Object.values(ogsScores.right).filter(s => s !== null).length) / 16
                      ) * 100)
                    }%
                  </div>
                </div>
              </div>
            )}
          </>
        )}
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
