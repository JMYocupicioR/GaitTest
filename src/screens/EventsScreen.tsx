import type {
  EventType,
  FootSide,
  GaitEvent,
  ObservationChecklist,
  OGSItemScore,
  OGSScore,
} from '../types/session.ts';
import type { CSSProperties, ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';
import { formatSeconds } from '../lib/format.ts';
import { OGSInput } from '../components/OGSInput.tsx';
import { PoseOverlay, PoseLegend } from '../components/PoseOverlay.tsx';
import { DEFAULT_OGS_SCORE } from '../types/session.ts';
import { computeMetrics } from '../lib/metrics.ts';
import { evaluatePatterns } from '../lib/patterns.ts';
import { getEventLabel } from '../lib/eventValidation.ts';
import { CLINICAL_COLORS } from '../lib/poseRenderer.ts';

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
const EVENT_TYPE_OPTIONS: EventType[] = [
  'heel_strike',
  'toe_off',
  'foot_flat',
  'heel_off',
  'max_knee_flexion',
  'max_hip_extension',
];

const bodyTimelineLayers = [
  { id: 'left', label: 'Pierna / brazo izquierdo', color: CLINICAL_COLORS.left },
  { id: 'right', label: 'Pierna / brazo derecho', color: CLINICAL_COLORS.right },
  { id: 'midline', label: 'Tronco', color: CLINICAL_COLORS.midline },
  { id: 'face', label: 'Cara', color: CLINICAL_COLORS.face },
] as const;

type GaitPhaseKind = 'stance' | 'swing' | 'incomplete';

interface GaitPhaseSegment {
  id: string;
  foot: FootSide;
  kind: GaitPhaseKind;
  label: string;
  start: number;
  end: number;
}

const gaitPhaseLabel: Record<GaitPhaseKind, string> = {
  stance: 'Apoyo',
  swing: 'Balanceo',
  incomplete: 'Ciclo incompleto',
};

const markerClassForEventType = (type: EventType): string => {
  if (type === 'toe_off') return 'toeoff';
  if (type === 'foot_flat') return 'footflat';
  if (type === 'heel_off') return 'heeloff';
  if (type === 'max_knee_flexion') return 'kneeflex';
  if (type === 'max_hip_extension') return 'hipext';
  return 'heelstrike';
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const buildGaitPhaseSegments = (
  events: readonly GaitEvent[],
): GaitPhaseSegment[] => {
  const active = events
    .filter((event) => event.reviewStatus !== 'rejected')
    .sort((a, b) => a.timestamp - b.timestamp);
  const segments: GaitPhaseSegment[] = [];

  (['L', 'R'] as const).forEach((foot) => {
    const footEvents = active.filter((event) => event.foot === foot);
    const heelStrikes = footEvents.filter((event) => event.type === 'heel_strike');

    for (let index = 0; index < heelStrikes.length - 1; index += 1) {
      const startHeelStrike = heelStrikes[index];
      const endHeelStrike = heelStrikes[index + 1];
      const toeOff = footEvents.find(
        (event) =>
          event.type === 'toe_off' &&
          event.timestamp > startHeelStrike.timestamp &&
          event.timestamp < endHeelStrike.timestamp,
      );

      if (toeOff) {
        segments.push({
          id: `${foot}-${startHeelStrike.id}-${toeOff.id}-stance`,
          foot,
          kind: 'stance',
          label: gaitPhaseLabel.stance,
          start: startHeelStrike.timestamp,
          end: toeOff.timestamp,
        });
        segments.push({
          id: `${foot}-${toeOff.id}-${endHeelStrike.id}-swing`,
          foot,
          kind: 'swing',
          label: gaitPhaseLabel.swing,
          start: toeOff.timestamp,
          end: endHeelStrike.timestamp,
        });
      } else {
        segments.push({
          id: `${foot}-${startHeelStrike.id}-${endHeelStrike.id}-incomplete`,
          foot,
          kind: 'incomplete',
          label: gaitPhaseLabel.incomplete,
          start: startHeelStrike.timestamp,
          end: endHeelStrike.timestamp,
        });
      }
    }
  });

  return segments.filter((segment) => segment.end > segment.start);
};

export const EventsScreen = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const session = useSessionStore((state) => state.session);
  const addGaitEvent = useSessionStore((state) => state.addGaitEvent);
  const addHeelStrike = useSessionStore((state) => state.addHeelStrike);
  const updateEvent = useSessionStore((state) => state.updateEvent);
  const updateEventType = useSessionStore((state) => state.updateEventType);
  const confirmEvent = useSessionStore((state) => state.confirmEvent);
  const rejectEvent = useSessionStore((state) => state.rejectEvent);
  const bulkConfirmEvents = useSessionStore((state) => state.bulkConfirmEvents);
  const validateGaitEvents = useSessionStore((state) => state.validateGaitEvents);
  const removeEvent = useSessionStore((state) => state.removeEvent);
  const setObservations = useSessionStore((state) => state.setObservations);
  const setOGSScore = useSessionStore((state) => state.setOGSScore);
  const setReviewSnapshot = useSessionStore((state) => state.setReviewSnapshot);
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
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [ogsWarning, setOgsWarning] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [newEventFoot, setNewEventFoot] = useState<FootSide>('L');
  const [newEventType, setNewEventType] = useState<EventType>('heel_strike');

  const poseFrames = session.poseFrames ?? [];
  const hasPoseFrames = poseFrames.length > 0;
  const sortedEvents = useMemo(
    () => [...session.events].sort((a, b) => a.timestamp - b.timestamp),
    [session.events],
  );
  const activeEvents = useMemo(
    () => sortedEvents.filter((event) => event.reviewStatus !== 'rejected'),
    [sortedEvents],
  );
  const gaitPhaseSegments = useMemo(
    () => buildGaitPhaseSegments(activeEvents),
    [activeEvents],
  );
  const timelineDuration = useMemo(() => {
    const fromQuality = session.quality.durationSeconds ?? 0;
    const fromEvents = sortedEvents.at(-1)?.timestamp ?? 0;
    const fromVideo = videoDuration > 0 ? videoDuration : 0;
    return Math.max(fromQuality, fromEvents, fromVideo, 1);
  }, [session.quality.durationSeconds, sortedEvents, videoDuration]);
  const currentPhaseByFoot = useMemo(() => {
    const phaseForFoot = (foot: FootSide) =>
      gaitPhaseSegments.find((segment) => (
        segment.foot === foot &&
        videoTime >= segment.start &&
        videoTime <= segment.end
      ));

    return {
      L: phaseForFoot('L'),
      R: phaseForFoot('R'),
    };
  }, [gaitPhaseSegments, videoTime]);
  const metricsPreview = useMemo(
    () =>
      computeMetrics({
        events: activeEvents,
        distanceMeters: session.captureSettings.distanceMeters,
        durationSeconds: session.quality.durationSeconds,
      }),
    [activeEvents, session.captureSettings.distanceMeters, session.quality.durationSeconds],
  );
  const suggestedFlags = useMemo(
    () =>
      evaluatePatterns({
        metrics: metricsPreview,
        observations: session.observations,
        viewMode: session.captureSettings.viewMode,
        quality: session.quality,
      }),
    [metricsPreview, session.observations, session.captureSettings.viewMode, session.quality],
  );
  const highlightedFlags = useMemo(
    () => suggestedFlags.filter((flag) => flag.status === 'likely' || flag.status === 'possible'),
    [suggestedFlags],
  );
  const selectedEvent =
    sortedEvents.find((event) => event.id === selectedEventId) ??
    sortedEvents[0] ??
    null;

  useEffect(() => {
    void validateGaitEvents();
  }, [validateGaitEvents]);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      if (Number.isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };
    const onTimeUpdate = () => setVideoTime(video.currentTime);

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [videoUrl]);

  const seekVideo = (timestamp: number) => {
    const target = Math.max(0, Math.min(timelineDuration, timestamp));
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    setVideoTime(target);
  };

  const jumpToEvent = (timestamp: number) => {
    seekVideo(timestamp);
  };

  const nudgeVideo = (seconds: number) => {
    const currentTime = videoRef.current?.currentTime ?? videoTime;
    seekVideo(currentTime + seconds);
  };

  const handleTimelineScrub = (event: ChangeEvent<HTMLInputElement>) => {
    const target = Number(event.target.value);
    if (!Number.isNaN(target)) {
      seekVideo(target);
    }
  };

  const handleAddHeelStrike = (foot: 'L' | 'R') => {
    if (!videoRef.current) {
      addHeelStrike(foot, 0);
      return;
    }
    addHeelStrike(foot, Number(videoRef.current.currentTime.toFixed(2)));
  };

  const handleAddCustomEvent = () => {
    const timestamp = videoRef.current ? Number(videoRef.current.currentTime.toFixed(2)) : 0;
    addGaitEvent({
      foot: newEventFoot,
      type: newEventType,
      timestamp,
      source: 'manual',
      confidence: 0.9,
    });
  };

  const handleTimeChange = (eventId: string, value: string) => {
    if (value.trim() === '') {
      return;
    }
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

  const ogsScoresComplete = useMemo(() => {
    const leftComplete = Object.values(ogsScores.left ?? DEFAULT_OGS_SCORE).every((item) => item !== null);
    const rightComplete = Object.values(ogsScores.right ?? DEFAULT_OGS_SCORE).every((item) => item !== null);
    return leftComplete && rightComplete;
  }, [ogsScores]);

  const ogsHasAnyValue = useMemo(() => {
    const values = [
      ...Object.values(ogsScores.left ?? DEFAULT_OGS_SCORE),
      ...Object.values(ogsScores.right ?? DEFAULT_OGS_SCORE),
    ];
    return values.some((value) => value !== null);
  }, [ogsScores]);

  const ogsCompletionPct = useMemo(() => {
    const values = [
      ...Object.values(ogsScores.left ?? DEFAULT_OGS_SCORE),
      ...Object.values(ogsScores.right ?? DEFAULT_OGS_SCORE),
    ];
    const completed = values.filter((value) => value !== null).length;
    return Math.round((completed / 16) * 100);
  }, [ogsScores]);

  const canContinue = Boolean(session.eventValidation?.isReady);

  const handleContinue = async () => {
    setAnalysisError(null);
    setOgsWarning(null);

    const validation = validateGaitEvents();
    if (!validation?.isReady) {
      setAnalysisError(validation?.issues[0] ?? 'Faltan eventos válidos para continuar.');
      return;
    }

    if (ogsHasAnyValue && ogsScoresComplete && ogsScores.left && ogsScores.right) {
      setOGSScore(ogsScores.left, ogsScores.right);
    } else if (ogsHasAnyValue && !ogsScoresComplete) {
      setOgsWarning('OGS incompleto: se continuará sin consolidar la puntuación final OGS.');
    }

    setReviewSnapshot({
      validatedAtIso: new Date().toISOString(),
      eventValidation: validation,
      suggestedFlags: highlightedFlags,
      metricsPreview,
      ogsCompletionPct,
    });

    setAnalysisBusy(true);
    try {
      await finalizeAnalysis();
      navigate('/results');
    } catch (err) {
      console.error(err);
      setAnalysisError('No se pudo completar el análisis. Inténtalo de nuevo.');
    } finally {
      setAnalysisBusy(false);
    }
  };

  return (
    <div className="page">
      <span className="step-indicator">Paso 4 · Revisión</span>
      <header className="page-header">
        <h1>Revisión y evaluación observacional</h1>
        <p>Valida eventos, corrige tags clínicos y prepara un bundle fiable para informe médico y exportación biomecánica.</p>
      </header>

      <section className="card video-shell">
        {videoUrl ? (
          <div className="video-stage">
            <video ref={videoRef} controls src={videoUrl} playsInline />
            <PoseOverlay
              mode="playback"
              videoRef={videoRef}
              frames={poseFrames}
              visible={showSkeleton && hasPoseFrames}
            />
          </div>
        ) : (
          <p className="helper-text">Todavía no hay video cargado. Vuelve a la cámara para grabar.</p>
        )}
        {hasPoseFrames && (
          <>
            <label className="touch-checkbox-label" style={{ color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={showSkeleton}
                onChange={(event) => setShowSkeleton(event.target.checked)}
              />
              <span>Mostrar puntos corporales sobre el video</span>
            </label>
            {showSkeleton && <PoseLegend />}
          </>
        )}
        {videoUrl && (
          <div className="event-timeline">
            <div className="review-scrubber-header">
              <span>Línea de tiempo grabada</span>
              <span>
                {formatSeconds(videoTime)} / {formatSeconds(timelineDuration)}
              </span>
            </div>
            <input
              type="range"
              className="review-scrubber"
              min={0}
              max={timelineDuration}
              step={0.01}
              value={Math.min(videoTime, timelineDuration)}
              onChange={handleTimelineScrub}
              aria-label="Ajustar posición del video grabado"
            />
            <div className="event-track">
              <div
                className="event-playhead"
                style={{
                  left: `calc(var(--event-layer-label-width) + (100% - var(--event-layer-label-width)) * ${Math.min(1, videoTime / timelineDuration)})`,
                }}
              />
              {bodyTimelineLayers.map((layer) => {
                const layerFoot = layer.id === 'left' ? 'L' : layer.id === 'right' ? 'R' : null;
                const layerEvents = sortedEvents.filter((event) => {
                  if (layer.id === 'left') return event.foot === 'L';
                  if (layer.id === 'right') return event.foot === 'R';
                  return false;
                });
                const layerSegments = layerFoot
                  ? gaitPhaseSegments.filter((segment) => segment.foot === layerFoot)
                  : [];

                return (
                  <div key={layer.id} className="event-layer-row">
                    <span className="event-layer-label">
                      <span className="swatch" style={{ background: layer.color }} />
                      {layer.label}
                    </span>
                    <div className="event-layer-body">
                      <div className="event-layer-line" />
                      {layerSegments.map((segment) => {
                        const left = clampPercent((segment.start / timelineDuration) * 100);
                        const right = clampPercent((segment.end / timelineDuration) * 100);
                        const width = Math.max(0.5, right - left);

                        return (
                          <button
                            key={segment.id}
                            type="button"
                            className="event-phase-segment"
                            data-phase={segment.kind}
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                            }}
                            title={`${segment.label} ${segment.foot === 'L' ? 'izquierdo' : 'derecho'} · ${formatSeconds(segment.start)} - ${formatSeconds(segment.end)}`}
                            onClick={() => seekVideo(segment.start)}
                          >
                            <span>{segment.label}</span>
                          </button>
                        );
                      })}
                      {layerEvents.map((event) => (
                        <button
                          key={`marker-${event.id}`}
                          type="button"
                          className={`event-marker ${markerClassForEventType(event.type)} ${selectedEventId === event.id ? 'selected' : ''}`}
                          style={{
                            left: `${Math.min(100, (event.timestamp / timelineDuration) * 100)}%`,
                            '--event-marker-color': layer.color,
                          } as CSSProperties}
                          title={`${getEventLabel(event.type)} ${event.foot} · ${event.timestamp.toFixed(2)} s`}
                          onClick={() => {
                            setSelectedEventId(event.id);
                            jumpToEvent(event.timestamp);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="event-timeline-labels">
              <span>0.0 s</span>
              <span>{timelineDuration.toFixed(1)} s</span>
            </div>
            <div className="gait-phase-readout" aria-live="polite">
              <span>
                Izq.: {currentPhaseByFoot.L ? `${currentPhaseByFoot.L.label} (${formatSeconds(currentPhaseByFoot.L.start)} - ${formatSeconds(currentPhaseByFoot.L.end)})` : 'sin fase activa'}
              </span>
              <span>
                Der.: {currentPhaseByFoot.R ? `${currentPhaseByFoot.R.label} (${formatSeconds(currentPhaseByFoot.R.start)} - ${formatSeconds(currentPhaseByFoot.R.end)})` : 'sin fase activa'}
              </span>
            </div>
            <div className="gait-phase-legend" aria-label="Leyenda de fases de marcha">
              <span><i data-phase="stance" />Apoyo: contacto inicial a toe-off</span>
              <span><i data-phase="swing" />Balanceo: toe-off al siguiente contacto</span>
              <span><i data-phase="incomplete" />Falta toe-off en el ciclo</span>
            </div>
          </div>
        )}
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => nudgeVideo(-0.5)} disabled={!videoUrl}>
            -0.5 s
          </button>
          <button type="button" className="secondary-button" onClick={() => nudgeVideo(0.5)} disabled={!videoUrl}>
            +0.5 s
          </button>
          <button type="button" className="secondary-button" onClick={() => void bulkConfirmEvents()}>
            Confirmar visibles
          </button>
        </div>
        <div className="button-row">
          <button type="button" className="primary-button" disabled={!videoUrl} onClick={() => handleAddHeelStrike('L')}>
            + Talón Izquierdo
          </button>
          <button type="button" className="primary-button" disabled={!videoUrl} onClick={() => handleAddHeelStrike('R')}>
            + Talón Derecho
          </button>
          <select value={newEventFoot} onChange={(event) => setNewEventFoot(event.target.value as FootSide)}>
            <option value="L">Evento manual - Izq.</option>
            <option value="R">Evento manual - Der.</option>
          </select>
          <select value={newEventType} onChange={(event) => setNewEventType(event.target.value as EventType)}>
            {EVENT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {getEventLabel(type)}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-button" disabled={!videoUrl} onClick={handleAddCustomEvent}>
            Agregar evento actual
          </button>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Eventos detectados ({sortedEvents.length})</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span className="badge medium">IC Izq: {session.eventValidation?.counts.heelStrikeLeft ?? 0}</span>
          <span className="badge medium">IC Der: {session.eventValidation?.counts.heelStrikeRight ?? 0}</span>
          <span className="badge medium">TO Izq: {session.eventValidation?.counts.toeOffLeft ?? 0}</span>
          <span className="badge medium">TO Der: {session.eventValidation?.counts.toeOffRight ?? 0}</span>
          <span className="badge medium">Ciclos: {session.eventValidation?.cycleCount ?? 0}</span>
          <span className="badge medium">Conf. media: {session.eventValidation?.meanConfidence != null ? `${Math.round(session.eventValidation.meanConfidence * 100)}%` : '—'}</span>
        </div>
        {session.eventValidation?.issues.length ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: '8px', padding: '0.75rem' }}>
            <strong style={{ color: '#b91c1c' }}>Bloqueos para continuar</strong>
            <ul style={{ margin: '0.5rem 0 0 1rem' }}>
              {session.eventValidation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {session.eventValidation?.warnings.length ? (
          <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: '8px', padding: '0.75rem' }}>
            <strong style={{ color: '#92400e' }}>Advertencias de calidad</strong>
            <ul style={{ margin: '0.5rem 0 0 1rem' }}>
              {session.eventValidation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {sortedEvents.length === 0 ? (
          <p className="helper-text">Marca al menos dos eventos por pierna para habilitar el análisis.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sortedEvents.map((event) => (
              <div key={event.id} className="event-item">
                <span className="event-item-side">{event.foot === 'L' ? 'Izq.' : 'Der.'}</span>
                <select
                  value={event.foot}
                  onChange={(changeEvent) => updateEvent(event.id, { foot: changeEvent.target.value as FootSide })}
                >
                  <option value="L">Izq.</option>
                  <option value="R">Der.</option>
                </select>
                <select
                  value={event.type}
                  onChange={(changeEvent) => updateEventType(event.id, changeEvent.target.value as EventType)}
                >
                  {EVENT_TYPE_OPTIONS.map((type) => (
                    <option key={`${event.id}-${type}`} value={type}>
                      {getEventLabel(type)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.05}
                  min={0}
                  value={event.timestamp}
                  onChange={(changeEvent) => handleTimeChange(event.id, changeEvent.target.value)}
                  className="event-item-input"
                />
                <span className="event-item-time">{formatSeconds(event.timestamp)}</span>
                <span className="badge medium">{event.source === 'auto' ? 'Auto' : 'Manual'}</span>
                <span className={`badge ${event.reviewStatus === 'confirmed' ? 'green' : event.reviewStatus === 'rejected' ? 'red' : 'yellow'}`}>
                  {event.reviewStatus}
                </span>
                <span className="badge medium">
                  {event.confidence != null ? `${Math.round(event.confidence * 100)}%` : 'Sin conf.'}
                </span>
                {event.qualityFlags.length > 0 && (
                  <span className="badge red">{event.qualityFlags.join(', ')}</span>
                )}
                <button type="button" className="secondary-button" onClick={() => {
                  setSelectedEventId(event.id);
                  jumpToEvent(event.timestamp);
                }}>
                  Ir
                </button>
                <button type="button" className="secondary-button" onClick={() => confirmEvent(event.id)}>
                  Confirmar
                </button>
                <button type="button" className="secondary-button" onClick={() => rejectEvent(event.id)}>
                  Rechazar
                </button>
                <button type="button" className="secondary-button" onClick={() => removeEvent(event.id)}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
        {selectedEvent && (
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
            <strong>Evento seleccionado</strong>
            <span>
              {getEventLabel(selectedEvent.type)} {selectedEvent.foot} · {selectedEvent.timestamp.toFixed(2)} s
            </span>
            <textarea
              value={selectedEvent.clinicalNote ?? ''}
              placeholder="Nota clínica del evento (opcional)"
              onChange={(event) => updateEvent(selectedEvent.id, { clinicalNote: event.target.value || null })}
              rows={2}
            />
          </div>
        )}
      </section>

      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Hallazgos sugeridos (previos)</h2>
        <p className="helper-text">
          Vista preliminar basada en eventos validados y checklist antes del análisis final.
        </p>
        <div className="metric-grid">
          <div className="metric-card card">
            <h3>Cadencia preliminar</h3>
            <p>{metricsPreview.cadenceSpm != null ? `${Math.round(metricsPreview.cadenceSpm)} spm` : '—'}</p>
          </div>
          <div className="metric-card card">
            <h3>Apoyo Izq./Der.</h3>
            <p>
              {metricsPreview.stanceTimeLeft != null ? `${metricsPreview.stanceTimeLeft.toFixed(2)} s` : '—'} /{' '}
              {metricsPreview.stanceTimeRight != null ? `${metricsPreview.stanceTimeRight.toFixed(2)} s` : '—'}
            </p>
          </div>
          <div className="metric-card card">
            <h3>Asimetría apoyo</h3>
            <p>{metricsPreview.stanceAsymmetryPct != null ? `${metricsPreview.stanceAsymmetryPct.toFixed(1)}%` : '—'}</p>
          </div>
        </div>
        <div className="pattern-list">
          {highlightedFlags.length > 0 ? highlightedFlags.map((flag) => (
            <div key={`pre-${flag.id}`} className="pattern-item" data-status={flag.status}>
              <strong>{flag.label}</strong>
              <span>{flag.rationale}</span>
            </div>
          )) : (
            <p className="helper-text">No hay alertas preliminares relevantes con la evidencia actual.</p>
          )}
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Checklist observacional</h2>
        <div className="checkbox-grid">
          {observationFields.map((item) => (
            <label key={item.id} className="touch-checkbox-label">
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
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

      {analysisError ? (
        <p className="helper-text" style={{ color: '#dc2626' }}>
          {analysisError}
        </p>
      ) : null}
      {ogsWarning ? (
        <p className="helper-text" style={{ color: '#92400e' }}>
          {ogsWarning}
        </p>
      ) : null}

      <div className="button-row page-actions">
        <button type="button" className="secondary-button" onClick={() => navigate(-1)} disabled={analysisBusy}>
          Volver
        </button>
        <button type="button" className="primary-button" disabled={!canContinue || analysisBusy} onClick={() => void handleContinue()}>
          {analysisBusy ? 'Analizando…' : 'Ver resultados'}
        </button>
      </div>
    </div>
  );
};
