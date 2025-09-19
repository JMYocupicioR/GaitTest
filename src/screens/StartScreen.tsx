import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../state/sessionStore.ts';

const VIEW_OPTIONS = [
  { id: 'lateral', label: 'Vista lateral (recomendada)', available: true },
  { id: 'frontal', label: 'Vista frontal (próximamente)', available: false },
] as const;

type ViewOptionId = (typeof VIEW_OPTIONS)[number]['id'];

const captureChecklist = [
  'Coloca el móvil fijo a ~1 m de altura apuntando a la línea de marcha.',
  'Camina 5 metros marcados, cubriendo al menos dos ciclos por pierna.',
  'Iluminación uniforme, ropa que contraste con el fondo.',
];

export const StartScreen = () => {
  const navigate = useNavigate();
  const resetSession = useSessionStore((state) => state.resetSession);
  const setCaptureSettings = useSessionStore((state) => state.setCaptureSettings);
  const [selectedView, setSelectedView] = useState<ViewOptionId>('lateral');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    resetSession();
  }, [resetSession]);

  const handleContinue = () => {
    if (!consent) {
      return;
    }
    setCaptureSettings({ viewMode: selectedView, calibrationType: 'line' });
    navigate('/calibration');
  };

  return (
    <div className="page">
      <span className="step-indicator">Paso 1 · Preparar captura</span>
      <header className="page-header">
        <h1>Analiza la marcha en minutos</h1>
        <p>
          Sigue la guía rápida para grabar un clip lateral con buena calidad. El análisis inicial calcula velocidad,
          cadencia y asimetría y genera un informe clínico orientativo.
        </p>
      </header>

      <section className="card">
        <h2>Selecciona la vista</h2>
        <div className="button-row">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`secondary-button${selectedView === option.id ? ' selected' : ''}`}
              onClick={() => option.available && setSelectedView(option.id)}
              disabled={!option.available}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="helper-text">La vista frontal se activará en la versión 0.2. Por ahora nos centramos en lateral.</p>
      </section>

      <section className="card">
        <h2>Checklist rápido</h2>
        <ul>
          {captureChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>Acepto procesar el video solo en el dispositivo y entiendo que no se guardan diagnósticos definitivos.</span>
        </label>
      </section>

      <div className="button-row">
        <button type="button" className="primary-button" disabled={!consent} onClick={handleContinue}>
          Continuar a calibración
        </button>
      </div>
    </div>
  );
};
