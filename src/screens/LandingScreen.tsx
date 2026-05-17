import { Link } from 'react-router-dom';

const GaitLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.12" />
    <path
      d="M16 6C16 6 12 10 12 16C12 19.5 13 22 14.5 24L16 26L17.5 24C19 22 20 19.5 20 16C20 10 16 6 16 6Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="16" r="2" fill="currentColor" />
    <path d="M10 20H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <path d="M11 24H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
  </svg>
);

const features = [
  {
    title: 'Captura desde el navegador',
    description: 'Graba un video lateral con tu dispositivo. Sin hardware adicional, solo tu cámara.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
  },
  {
    title: 'Análisis biomecánico',
    description: 'Velocidad, cadencia, longitud de paso y asimetría calculados con pose estimation en tiempo real.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: 'Informe clínico PDF',
    description: 'Genera reportes profesionales con gráficas cinemáticas, datos normativos y recomendaciones.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    title: 'Seguimiento longitudinal',
    description: 'Compara sesiones a lo largo del tiempo y monitorea la evolución del paciente.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: 'Privacidad por defecto',
    description: 'Todo el procesamiento ocurre en tu dispositivo. Los videos no se envían a ningún servidor.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'Funciona offline',
    description: 'Aplicación web progresiva. Instálala en tu dispositivo y úsala sin conexión.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.55a11 11 0 0114.08 0" />
        <path d="M1.42 9a16 16 0 0121.16 0" />
        <path d="M8.53 16.11a6 6 0 016.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </svg>
    ),
  },
];

export const LandingScreen = () => {
  return (
    <div className="landing-page">
      <nav className="landing-nav" aria-label="Navegación principal">
        <div className="landing-nav-brand">
          <GaitLogo />
          <span>GAIT</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="ghost-button">
            Iniciar sesión
          </Link>
          <Link to="/signup" className="cta-button">
            Crear cuenta
          </Link>
        </div>
      </nav>

      <main className="landing-hero">
        <span className="landing-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Análisis en menos de 3 minutos
        </span>

        <h1>Análisis de marcha clínico desde tu navegador</h1>

        <p>
          Captura un video lateral, obtén métricas biomecánicas precisas y genera informes
          profesionales. Sin sensores, sin equipos caros.
        </p>

        <div className="landing-cta-row">
          <Link to="/signup" className="cta-button">
            Comenzar gratis
          </Link>
          <Link to="/login" className="secondary-button">
            Ya tengo cuenta
          </Link>
        </div>
      </main>

      <section className="landing-features" aria-label="Características">
        <h2>Todo lo que necesitas para evaluar la marcha</h2>
        <div className="features-grid">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        GAIT · Analizador de marcha &mdash; Herramienta orientativa, no sustituye el criterio clínico profesional.
      </footer>
    </div>
  );
};
