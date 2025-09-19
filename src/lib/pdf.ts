import jsPDF from 'jspdf';
import { formatCadence, formatMeters, formatMetersPerSecond, formatPercentage } from './format.ts';
import type { SessionData } from '../types/session.ts';

export const buildSessionPdf = (session: SessionData): Blob => {
  const doc = new jsPDF({ unit: 'pt' });
  const margin = 48;
  let cursorY = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Informe de marcha · MVP GAIT', doc.internal.pageSize.getWidth() / 2, cursorY, { align: 'center' });
  cursorY += 28;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${new Date(session.createdAtIso).toLocaleString()}`, margin, cursorY);
  cursorY += 16;
  if (session.patient?.name) {
    doc.text(`Paciente: ${session.patient.name}`, margin, cursorY);
    cursorY += 14;
  }
  if (session.patient?.identifier) {
    doc.text(`Identificador: ${session.patient.identifier}`, margin, cursorY);
    cursorY += 14;
  }
  doc.text(`Vista: ${session.captureSettings.viewMode}`, margin, cursorY);
  cursorY += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Métricas clave', margin, cursorY);
  cursorY += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const metrics = [
    `Velocidad: ${formatMetersPerSecond(session.metrics.speedMps)}`,
    `Cadencia: ${formatCadence(session.metrics.cadenceSpm)}`,
    `Longitud de paso (media): ${formatMeters(session.metrics.stepLengthMeters)}`,
    `Asimetría de apoyo: ${formatPercentage(session.metrics.stanceAsymmetryPct)}`,
  ];
  metrics.forEach((line) => {
    doc.text(line, margin, cursorY);
    cursorY += 16;
  });

  cursorY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Patrones sugeridos', margin, cursorY);
  cursorY += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  session.patternFlags.forEach((flag) => {
    doc.text(`${flag.label} · Estado: ${flag.status}`, margin, cursorY);
    cursorY += 14;
    doc.text(doc.splitTextToSize(flag.rationale, doc.internal.pageSize.getWidth() - margin * 2), margin + 12, cursorY);
    cursorY += 28;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Semáforo y notas', margin, cursorY);
  cursorY += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Semáforo: ${session.report.trafficLight.toUpperCase()}`, margin, cursorY);
  cursorY += 16;
  doc.text(doc.splitTextToSize(session.report.notes || 'Sin notas registradas.', doc.internal.pageSize.getWidth() - margin * 2), margin, cursorY);
  cursorY += 32;

  if (session.patient?.clinicianNote) {
    doc.setFont('helvetica', 'bold');
    doc.text('Comentario clínico', margin, cursorY);
    cursorY += 18;
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(session.patient.clinicianNote, doc.internal.pageSize.getWidth() - margin * 2), margin, cursorY);
  }

  doc.setFontSize(9);
  doc.setTextColor('#6b7280');
  doc.text(
    'MVP informativo. Verificar presencia clínica antes de decisiones terapéuticas. © 2025 DeepLuxMed',
    doc.internal.pageSize.getWidth() / 2,
    doc.internal.pageSize.getHeight() - margin,
    { align: 'center' },
  );

  return doc.output('blob');
};
