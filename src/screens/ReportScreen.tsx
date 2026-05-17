import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildProfessionalPdf } from '../lib/professionalPdf.ts';
import { formatDate } from '../lib/format.ts';
import { useSessionStore } from '../state/sessionStore.ts';
import { buildSessionPayload } from '../lib/sessionSchema.ts';
import { GaitPhaseDiagram } from '../components/GaitPhaseDiagram.tsx';
import { KinematicChartCanvas } from '../components/KinematicChartCanvas.tsx';

export const ReportScreen = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const setPatientInfo = useSessionStore((state) => state.setPatientInfo);
  const setReportSummary = useSessionStore((state) => state.setReportSummary);
  const [generating, setGenerating] = useState(false);
  const [jsonUrl, setJsonUrl] = useState<string | null>(null);

  const [name, setName] = useState(session.patient?.name ?? '');
  const [identifier, setIdentifier] = useState(session.patient?.identifier ?? '');
  const [age, setAge] = useState<number | ''>(session.patient?.age ?? '');
  const [height, setHeight] = useState<number | ''>(session.patient?.height ?? '');
  const [sex, setSex] = useState<'male' | 'female' | 'other'>(session.patient?.sex ?? 'other');
  const [clinicianNote, setClinicianNote] = useState(session.patient?.clinicianNote ?? '');

  useEffect(() => {
    setPatientInfo({
      name,
      identifier,
      age: age === '' ? undefined : age,
      height: height === '' ? undefined : height,
      sex,
      clinicianNote,
    });
  }, [age, clinicianNote, height, identifier, name, setPatientInfo, sex]);

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
      const blob = buildProfessionalPdf({
        ...session,
        patient: {
          name,
          identifier,
          age: age === '' ? undefined : age,
          height: height === '' ? undefined : height,
          sex,
          clinicianNote,
        },
      });
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

  // Extract kinematic data for chart preview
  const kinData = session.enhancedAnalysisResult?.kinematicSummary?.kinematicData;
  const hipL = kinData?.sagittal?.hipFlexion?.left?.summary?.normalizedCycles?.mean101 ?? kinData?.sagittal?.hipFlexion?.left?.series?.angles ?? null;
  const hipR = kinData?.sagittal?.hipFlexion?.right?.summary?.normalizedCycles?.mean101 ?? kinData?.sagittal?.hipFlexion?.right?.series?.angles ?? null;
  const kneeL = kinData?.sagittal?.kneeFlexion?.left?.summary?.normalizedCycles?.mean101 ?? kinData?.sagittal?.kneeFlexion?.left?.series?.angles ?? null;
  const kneeR = kinData?.sagittal?.kneeFlexion?.right?.summary?.normalizedCycles?.mean101 ?? kinData?.sagittal?.kneeFlexion?.right?.series?.angles ?? null;
  const ankleL = kinData?.sagittal?.ankleFlexion?.left?.summary?.normalizedCycles?.mean101 ?? kinData?.sagittal?.ankleFlexion?.left?.series?.angles ?? null;
  const ankleR = kinData?.sagittal?.ankleFlexion?.right?.summary?.normalizedCycles?.mean101 ?? kinData?.sagittal?.ankleFlexion?.right?.series?.angles ?? null;

  return (
    <form className="page" onSubmit={handleSubmit}>
      <span className="step-indicator">Informe final</span>
      <header className="page-header">
        <h1>Reporte Clínico Profesional</h1>
        <p>Genera un informe PDF de 4 páginas con gráficos cinemáticos, ilustraciones de fases de la marcha, y hallazgos clínicos.</p>
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
          <label htmlFor="age">Edad</label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={age}
            onChange={(event) => setAge(event.target.value === '' ? '' : Number(event.target.value))}
          />
        </div>
        <div className="form-section">
          <label htmlFor="height">Estatura (cm)</label>
          <input
            id="height"
            type="number"
            inputMode="numeric"
            min={50}
            max={230}
            value={height}
            onChange={(event) => setHeight(event.target.value === '' ? '' : Number(event.target.value))}
          />
        </div>
        <div className="form-section">
          <label htmlFor="sex">Sexo</label>
          <select id="sex" value={sex} onChange={(event) => setSex(event.target.value as 'male' | 'female' | 'other')}>
            <option value="other">No especificado</option>
            <option value="female">Femenino</option>
            <option value="male">Masculino</option>
          </select>
        </div>
        <div className="form-section">
          <label htmlFor="note">Comentario clínico</label>
          <textarea
            id="note"
            rows={4}
            style={{ minHeight: '120px' }}
            value={clinicianNote}
            onChange={(event) => setClinicianNote(event.target.value)}
            placeholder="Observaciones, plan de seguimiento, indicaciones."
          />
        </div>
      </section>

      {/* ─── Gait Phase Visual Preview ─── */}
      <GaitPhaseDiagram
        ogsLeft={session.ogs?.leftScore}
        ogsRight={session.ogs?.rightScore}
      />

      {/* ─── Kinematic Chart Previews ─── */}
      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Vista previa: Cinemática Articular</h2>
        <p className="helper-text">
          Curvas de ángulo articular (azul=izq, rojo=der) con bandas normativas (gris ±1 DE)
        </p>
        <KinematicChartCanvas jointIndex={0} patientDataLeft={hipL} patientDataRight={hipR} patientProfile={session.patient} />
        <KinematicChartCanvas jointIndex={1} patientDataLeft={kneeL} patientDataRight={kneeR} patientProfile={session.patient} />
        <KinematicChartCanvas jointIndex={2} patientDataLeft={ankleL} patientDataRight={ankleR} patientProfile={session.patient} />
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

      <div className="button-row page-actions">
        <button type="button" className="secondary-button" onClick={() => navigate('/results')}>
          Volver a resultados
        </button>
        <button type="submit" className="primary-button" disabled={generating}>
          {generating ? 'Generando reporte...' : '📄 Generar PDF Profesional'}
        </button>
        {canDownloadPdf && session.report.pdfUrl && (
          <a className="primary-button" href={session.report.pdfUrl} download={`gait-report-${session.sessionId}.pdf`}>
            ⬇ Descargar PDF
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
