import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { StartScreen } from './screens/StartScreen.tsx';
import { CalibrationScreen } from './screens/CalibrationScreen.tsx';
import { CaptureScreen } from './screens/CaptureScreen.tsx';
import { EventsScreen } from './screens/EventsScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { ReportScreen } from './screens/ReportScreen.tsx';
import { LongitudinalScreen } from './screens/LongitudinalScreen.tsx';

function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/calibration" element={<CalibrationScreen />} />
        <Route path="/capture" element={<CaptureScreen />} />
        <Route path="/events" element={<EventsScreen />} />
        <Route path="/results" element={<ResultsScreen />} />
        <Route path="/report" element={<ReportScreen />} />
        <Route path="/longitudinal" element={<LongitudinalScreen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
