import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import { LandingScreen } from './screens/LandingScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';
import { CalibrationScreen } from './screens/CalibrationScreen.tsx';
import { CaptureScreen } from './screens/CaptureScreen.tsx';
import { EventsScreen } from './screens/EventsScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { ReportScreen } from './screens/ReportScreen.tsx';
import { LongitudinalScreen } from './screens/LongitudinalScreen.tsx';
import { LoginScreen } from './screens/LoginScreen.tsx';
import { SignupScreen } from './screens/SignupScreen.tsx';
import { AuthGuard } from './components/AuthGuard.tsx';
import { useAuth } from './hooks/useAuth.ts';

const FLOW_STEPS = [
  { path: '/start', label: 'Preparar captura' },
  { path: '/calibration', label: 'Calibración' },
  { path: '/capture', label: 'Captura' },
  { path: '/events', label: 'Revisión' },
  { path: '/results', label: 'Resultados' },
  { path: '/report', label: 'Informe' },
] as const;

type ToastPayload = {
  message: string;
  type?: 'success' | 'error' | 'info';
};

function App() {
  const location = useLocation();
  const { user, loading, signOut } = useAuth();
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const publicRoutes = ['/', '/login', '/signup'];
  const isPublicRoute = publicRoutes.includes(location.pathname);
  const currentStepIndex = useMemo(
    () => FLOW_STEPS.findIndex((step) => step.path === location.pathname),
    [location.pathname],
  );
  const showFlowStepper = !isPublicRoute && Boolean(user) && currentStepIndex >= 0;

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    const handleToastEvent = (event: Event) => {
      const payload = (event as CustomEvent<ToastPayload>).detail;
      if (!payload?.message) {
        return;
      }
      setToast({
        message: payload.message,
        type: payload.type ?? 'info',
      });
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {!isPublicRoute && user && (
        <header className="app-topbar">
          <span className="helper-text app-topbar-email" title={user.email ?? ''}>
            {user.email}
          </span>
          <button type="button" className="ghost-button" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </header>
      )}
      {showFlowStepper && (
        <div className="flow-stepper" aria-label="Progreso del flujo de captura">
          {FLOW_STEPS.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isComplete = index < currentStepIndex;
            return (
              <div
                key={step.path}
                className="flow-step"
                data-active={isActive ? 'true' : 'false'}
                data-complete={isComplete ? 'true' : 'false'}
              >
                <span className="flow-step-dot" aria-hidden="true" />
                <span className="flow-step-label">{step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/start" replace /> : <LandingScreen />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/start" replace /> : <LoginScreen />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to="/start" replace /> : <SignupScreen />}
        />
        <Route
          path="/start"
          element={(
            <AuthGuard>
              <StartScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/calibration"
          element={(
            <AuthGuard>
              <CalibrationScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/capture"
          element={(
            <AuthGuard>
              <CaptureScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/events"
          element={(
            <AuthGuard>
              <EventsScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/results"
          element={(
            <AuthGuard>
              <ResultsScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/report"
          element={(
            <AuthGuard>
              <ReportScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/longitudinal"
          element={(
            <AuthGuard>
              <LongitudinalScreen />
            </AuthGuard>
          )}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {toast && (
        <div className="app-toast-container" role="status" aria-live="polite">
          <div className="app-toast" data-type={toast.type}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
