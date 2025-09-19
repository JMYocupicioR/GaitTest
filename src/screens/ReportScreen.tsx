import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildSessionPdf } from '../lib/pdf.ts';
import { formatDate } from '../lib/format.ts';
import { useSessionStore } from '../state/sessionStore.ts';
import { buildSessionPayload } from '../lib/sessionSchema.ts';

export const ReportScreen = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const setPatientInfo = useSessionStore((state) => state.setPatientInfo);
  const setReportSummary = useSessionStore((state) => state.setReportSummary);
  const [generating, setGenerating] = useState(false);
  const [jsonUrl, setJsonUrl] = useState<string | null>(null);

  const [name, setName] = useState(session.patient?.name ?? '');
  const [identifier, setIdentifier] = useState(session.patient?.identifier ?? '');
  const [clinicianNote, setClinicianNote] = useState(session.patient?.clinicianNote ?? '');

  useEffect(() => {
    setPatientInfo({ name, identifier, clinicianNote });
  }, [clinicianNote, identifier, name, setPatientInfo]);

  useEffect(
    () => () => {
      if (session.report.pdfUrl) {
        URL.revokeObjectURL(session.report.pdfUrl);
      }
    },
    [session.report.pdfUrl],
  );

  useEffect(() => () => {
    if (jsonUrl) {
      URL.revokeObjectURL(jsonUrl);
    }
  }, [jsonUrl]);

  const handleGeneratePdf = async () => {
    try {
      setGenerating(true);
      const blob = buildSessionPdf({ ...session, patient: { name, identifier, clinicianNote } });
      const blobUrl = URL.createObjectURL(blob);
      setReportSummary({ pdfUrl: blobUrl });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateJson = () => {
    const payload = buildSessionPayload(session);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    setJsonUrl(url);
  };

  const canDownloadPdf = useMemo(() => Boolean(session.report.pdfUrl), [session.report.pdfUrl]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleGeneratePdf();
  };

  return (
    <form className="page" onSubmit={handleSubmit}>
      <span className="step-indicator">Informe final</span>
      <header className="page-header">
        <h1>Prepara el reporte</h1>
        <p>Completa los datos opcionales del paciente y descarga un PDF con las métricas y alertas.</p>
      </header>

      <section className="card" style={{ display: 'grid', gap: '1rem' }}>
        <h2>Datos de sesión</h2>
        <p className="helper-text">Sesión: {session.sessionId} · Fecha: {formatDate(session.createdAtIso)}</p>
        <div className="form-section">
          <label htmlFor="name">Nombre paciente (opcional)</label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </div>
        <div className="form-section">
          <label htmlFor="identifier">Identificador / Historia</label>
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="form-section">
          <label htmlFor="note">Comentario clínico</label>
          <textarea
            id="note"
            rows={4}
            value={clinicianNote}
            onChange={(event) => setClinicianNote(event.target.value)}
            placeholder="Observaciones, plan de seguimiento, indicaciones."
          />
        </div>
      </section>

      <section className="card">
        <h2>Resumen rápido</h2>
        <p>{session.report.notes || 'Sin notas añadidas.'}</p>
        <ul>
          {session.patternFlags.map((flag) => (
            <li key={flag.id}>
              {flag.label}: <strong>{flag.status.replace('_', ' ')}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => navigate('/results')}>
          Volver a resultados
        </button>
        <button type="submit" className="primary-button" disabled={generating}>
          {generating ? 'Generando...' : 'Generar PDF'}
        </button>
        {canDownloadPdf && session.report.pdfUrl && (
          <a className="primary-button" href={session.report.pdfUrl} download={`gait-report-${session.sessionId}.pdf`}>
            Descargar PDF
          </a>
        )}
        <button type="button" className="secondary-button" onClick={handleGenerateJson}>
          Obtener JSON
        </button>
        {jsonUrl && (
          <a className="primary-button" href={jsonUrl} download={`gait-session-${session.sessionId}.json`}>
            Descargar JSON
          </a>
        )}
      </div>
    </form>
  );
};
