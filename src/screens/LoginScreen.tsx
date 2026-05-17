import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
  </svg>
);

const LogoIcon = () => (
  <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M14 4C14 4 10 8.5 10 14.5C10 17.5 11 20 12.5 22L14 24L15.5 22C17 20 18 17.5 18 14.5C18 8.5 14 4 14 4Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="14" cy="14.5" r="1.8" fill="currentColor" />
  </svg>
);

export const LoginScreen = () => {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate('/start?new=1', { replace: true });
    }
  }, [loading, navigate, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      navigate('/start?new=1', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-logo">
            <LogoIcon />
          </div>
          <h1>Iniciar sesión</h1>
          <p>Accede con tu cuenta para gestionar sesiones de pacientes.</p>
        </div>

        <div className="auth-card">
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-section">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-section">
              <label htmlFor="password">Contraseña</label>
              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <p className="auth-error" role="alert">{errorMessage}</p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={submitting || loading}
              style={{ width: '100%' }}
            >
              {submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          ¿No tienes cuenta? <Link to="/signup">Crear cuenta</Link>
        </p>
      </div>
    </div>
  );
};
