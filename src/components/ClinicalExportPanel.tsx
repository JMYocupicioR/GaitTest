import { useMemo, useState } from 'react';
import type { SessionData } from '../types/session.ts';
import {
  type CoordinateMode,
  ExportService,
  type ClinicalExportFormat,
  type ClinicalExportResult,
  type ClinicalTargetSystem,
} from '../services/exportService.ts';

interface ClinicalExportPanelProps {
  session: SessionData;
}

function hasPrerequisites(session: SessionData): boolean {
  return Boolean(session.poseFrames?.length && session.poseFrames.length > 60 && session.metrics.steps > 0);
}

export function ClinicalExportPanel({ session }: ClinicalExportPanelProps) {
  const [targetSystem, setTargetSystem] = useState<ClinicalTargetSystem>('OpenSim');
  const [coordinateMode, setCoordinateMode] = useState<CoordinateMode>('yup_m');
  const [running, setRunning] = useState<ClinicalExportFormat | 'all' | null>(null);
  const [message, setMessage] = useState<string>('');
  const [results, setResults] = useState<ClinicalExportResult[]>([]);

  const canExport = useMemo(() => hasPrerequisites(session), [session]);

  const runExport = async (format: ClinicalExportFormat | 'all') => {
    if (!canExport) {
      setMessage('Se requieren al menos 60 pose frames y métricas calculadas.');
      return;
    }

    setRunning(format);
    setMessage('');
    try {
      if (format === 'trc') {
        const result = await ExportService.exportTRC(session, targetSystem, coordinateMode);
        ExportService.downloadBlob(result);
        setResults((prev) => [result, ...prev.filter((item) => item.fileName !== result.fileName)]);
        setMessage(`Exportación TRC completada (${coordinateMode}).`);
      } else if (format === 'mot') {
        const result = await ExportService.exportMOT(session, targetSystem, coordinateMode);
        ExportService.downloadBlob(result);
        setResults((prev) => [result, ...prev.filter((item) => item.fileName !== result.fileName)]);
        setMessage(`Exportación MOT completada (${coordinateMode}).`);
      } else if (format === 'c3d') {
        const result = await ExportService.exportC3D(session, targetSystem, coordinateMode);
        setResults((prev) => [result, ...prev.filter((item) => item.fileName !== result.fileName)]);
        setMessage('Exportación C3D enviada al servicio remoto.');
      } else if (format === 'sidecar_json') {
        const result = ExportService.exportSidecar(session, targetSystem, coordinateMode);
        ExportService.downloadBlob(result);
        setResults((prev) => [result, ...prev.filter((item) => item.fileName !== result.fileName)]);
        setMessage('Sidecar clínico generado.');
      } else {
        const exportResults = await ExportService.exportAll(session, targetSystem, coordinateMode);
        exportResults.forEach((result) => {
          if (result.blob) ExportService.downloadBlob(result);
        });
        setResults((prev) => [...exportResults, ...prev].slice(0, 10));
        setMessage('Exportación clínica completa finalizada.');
      }
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Ocurrió un error en la exportación clínica.');
    } finally {
      setRunning(null);
    }
  };

  return (
    <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>Exportación clínica</h2>
      <p className="helper-text">
        Exporta la sesión en formatos de interoperabilidad biomecánica: C3D (Visual3D/Vicon), TRC y MOT (OpenSim).
      </p>

      <div className="form-section">
        <label htmlFor="target-system">Sistema destino</label>
        <select
          id="target-system"
          value={targetSystem}
          onChange={(event) => setTargetSystem(event.target.value as ClinicalTargetSystem)}
        >
          <option value="OpenSim">OpenSim</option>
          <option value="Visual3D">Visual3D</option>
          <option value="AnyBody">AnyBody</option>
          <option value="Generic">Genérico</option>
        </select>
      </div>

      <div className="form-section">
        <label htmlFor="coordinate-mode">Sistema de coordenadas</label>
        <select
          id="coordinate-mode"
          value={coordinateMode}
          onChange={(event) => setCoordinateMode(event.target.value as CoordinateMode)}
        >
          <option value="yup_m">Y-Up (m) para OpenSim</option>
          <option value="zup_mm">Z-Up (mm) para C3D</option>
        </select>
      </div>

      <div className="button-row">
        <button type="button" className="secondary-button" disabled={Boolean(running)} onClick={() => void runExport('trc')}>
          {running === 'trc' ? 'Exportando TRC...' : 'Exportar .TRC'}
        </button>
        <button type="button" className="secondary-button" disabled={Boolean(running)} onClick={() => void runExport('mot')}>
          {running === 'mot' ? 'Exportando MOT...' : 'Exportar .MOT'}
        </button>
        <button type="button" className="secondary-button" disabled={Boolean(running)} onClick={() => void runExport('c3d')}>
          {running === 'c3d' ? 'Exportando C3D...' : 'Exportar .C3D'}
        </button>
        <button type="button" className="secondary-button" disabled={Boolean(running)} onClick={() => void runExport('sidecar_json')}>
          {running === 'sidecar_json' ? 'Generando sidecar...' : 'Exportar sidecar JSON'}
        </button>
        <button type="button" className="primary-button" disabled={Boolean(running)} onClick={() => void runExport('all')}>
          {running === 'all' ? 'Exportando...' : 'Exportar todo'}
        </button>
      </div>

      {!canExport && (
        <p className="helper-text">
          Requisito: al menos 60 frames de pose y una sesión analizada para exportación clínica.
        </p>
      )}

      {message && <p className="helper-text">{message}</p>}

      {results.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '0.5rem' }}>Archivos generados</h3>
          <ul>
            {results.map((result) => (
              <li key={`${result.format}-${result.fileName}`}>
                <strong>{result.fileName}</strong>{' '}
                {result.signedUrl ? (
                  <a href={result.signedUrl} target="_blank" rel="noreferrer">
                    Descargar desde Storage
                  </a>
                ) : (
                  <span>Descargado localmente</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
