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

function getPasswordStrength(password: string): { level: number; label: string } {
  if (password.length === 0) return { level: 0, label: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Débil' };
  if (score <= 3) return { level: 2, label: 'Media' };
  return { level: 3, label: 'Fuerte' };
}

const strengthColors = ['', 'var(--color-error)', '#D97706', 'var(--color-cta)'];

export const SignupScreen = () => {
  const navigate = useNavigate();
  const { user, loading, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (!loading && user) {
      navigate('/start?new=1', { replace: true });
    }
  }, [loading, navigate, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await signUp(email.trim(), password);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.user && !data.session) {
        setSuccessMessage('Cuenta creada. Revisa tu correo para confirmar el acceso.');
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
          <h1>Crear cuenta</h1>
          <p>Registra una cuenta para gestionar pacientes y guardar históricos de marcha.</p>
        </div>

        <div className="auth-card">
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-section">
              <label htmlFor="signup-email">Correo electrónico</label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-section">
              <label htmlFor="signup-password">Contraseña</label>
              <div className="password-wrapper">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
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
              {strength.level > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: '3px',
                          flex: 1,
                          borderRadius: '2px',
                          background: i <= strength.level ? strengthColors[strength.level] : 'var(--color-border-light)',
                          transition: 'background 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: strengthColors[strength.level], fontWeight: 500 }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="form-section">
              <label htmlFor="signup-confirm-password">Confirmar contraseña</label>
              <div className="password-wrapper">
                <input
                  id="signup-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <p className="auth-error" role="alert">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="auth-success" role="status">{successMessage}</p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={submitting || loading}
              style={{ width: '100%' }}
            >
              {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
};
