import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildProfessionalPdf } from '../lib/professionalPdf.ts';
import { formatDate } from '../lib/format.ts';
import { useSessionStore } from '../state/sessionStore.ts';
import { buildSessionPayload } from '../lib/sessionSchema.ts';
import { GaitPhaseDiagram } from '../components/GaitPhaseDiagram.tsx';
import { KinematicChartCanvas } from '../components/KinematicChartCanvas.tsx';
import { ClinicalExportPanel } from '../components/ClinicalExportPanel.tsx';
import {
  PatientBiometricsForm,
  patientBiometricsFromSession,
  type PatientBiometricsValues,
} from '../components/PatientBiometricsForm.tsx';

export const ReportScreen = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const setPatientInfo = useSessionStore((state) => state.setPatientInfo);
  const setReportSummary = useSessionStore((state) => state.setReportSummary);
  const [generating, setGenerating] = useState(false);
  const [jsonUrl, setJsonUrl] = useState<string | null>(null);

  const [patientForm, setPatientForm] = useState<PatientBiometricsValues>(() =>
    patientBiometricsFromSession(session.patient),
  );
  const [clinicianNote, setClinicianNote] = useState(session.patient?.clinicianNote ?? '');

  useEffect(() => {
    setPatientInfo({
      name: patientForm.name || undefined,
      identifier: patientForm.identifier || undefined,
      age: patientForm.age === '' ? undefined : patientForm.age,
      height: patientForm.height === '' ? undefined : patientForm.height,
      weight: patientForm.weight === '' ? undefined : patientForm.weight,
      sex: patientForm.sex,
      heightSource: patientForm.height === '' ? session.patient?.heightSource : 'manual',
      clinicianNote,
    });
  }, [clinicianNote, patientForm, setPatientInfo, session.patient?.heightSource]);

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
          name: patientForm.name || undefined,
          identifier: patientForm.identifier || undefined,
          age: patientForm.age === '' ? undefined : patientForm.age,
          height: patientForm.height === '' ? undefined : patientForm.height,
          weight: patientForm.weight === '' ? undefined : patientForm.weight,
          sex: patientForm.sex,
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
        <p className="helper-text">Los datos antropométricos se capturan al inicio; aquí puedes revisarlos o corregirlos.</p>
        <PatientBiometricsForm
          values={patientForm}
          onChange={setPatientForm}
          requireHeight={false}
          showClinicalNote
          clinicalNote={clinicianNote}
          onClinicalNoteChange={setClinicianNote}
        />
        {patientForm.height === '' && session.patient?.heightSource === 'estimated' && session.patient.estimatedHeight != null && (
          <p className="helper-text">
            Estatura estimada automáticamente: {session.patient.estimatedHeight.toFixed(1)} cm
          </p>
        )}
      </section>

      <GaitPhaseDiagram
        ogsLeft={session.ogs?.leftScore}
        ogsRight={session.ogs?.rightScore}
      />

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

      <ClinicalExportPanel session={session} />

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
