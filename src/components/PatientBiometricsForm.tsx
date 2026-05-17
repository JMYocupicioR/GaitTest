import type { SessionData } from '../types/session.ts';

export type PatientProfile = NonNullable<SessionData['patient']>;

export type PatientBiometricsValues = {
  name: string;
  identifier: string;
  age: number | '';
  height: number | '';
  weight: number | '';
  sex: NonNullable<PatientProfile['sex']>;
};

export const emptyPatientBiometrics = (): PatientBiometricsValues => ({
  name: '',
  identifier: '',
  age: '',
  height: '',
  weight: '',
  sex: 'other',
});

export function patientBiometricsFromSession(patient: PatientProfile | undefined): PatientBiometricsValues {
  if (!patient) {
    return emptyPatientBiometrics();
  }
  return {
    name: patient.name ?? '',
    identifier: patient.identifier ?? '',
    age: patient.age ?? '',
    height: patient.height ?? '',
    weight: patient.weight ?? '',
    sex: patient.sex ?? 'other',
  };
}

export function patientBiometricsToStorePayload(
  values: PatientBiometricsValues,
  options?: { clinicianNote?: string },
): PatientProfile {
  return {
    name: values.name || undefined,
    identifier: values.identifier || undefined,
    age: values.age === '' ? undefined : values.age,
    height: values.height === '' ? undefined : values.height,
    weight: values.weight === '' ? undefined : values.weight,
    sex: values.sex,
    heightSource: values.height === '' ? undefined : 'manual',
    clinicianNote: options?.clinicianNote || undefined,
  };
}

interface PatientBiometricsFormProps {
  values: PatientBiometricsValues;
  onChange: (values: PatientBiometricsValues) => void;
  requireHeight?: boolean;
  showIdentityFields?: boolean;
  showClinicalNote?: boolean;
  clinicalNote?: string;
  onClinicalNoteChange?: (note: string) => void;
}

export function PatientBiometricsForm({
  values,
  onChange,
  requireHeight = true,
  showIdentityFields = true,
  showClinicalNote = false,
  clinicalNote = '',
  onClinicalNoteChange,
}: PatientBiometricsFormProps) {
  const patch = (partial: Partial<PatientBiometricsValues>) => onChange({ ...values, ...partial });

  return (
    <>
      {showIdentityFields && (
        <>
          <div className="form-section">
            <label htmlFor="patient-name">Nombre paciente (opcional)</label>
            <input
              id="patient-name"
              value={values.name}
              onChange={(event) => patch({ name: event.target.value })}
              autoComplete="name"
            />
          </div>
          <div className="form-section">
            <label htmlFor="patient-identifier">Identificador / Historia</label>
            <input
              id="patient-identifier"
              value={values.identifier}
              onChange={(event) => patch({ identifier: event.target.value })}
              autoComplete="off"
            />
          </div>
        </>
      )}
      <div className="form-section">
        <label htmlFor="patient-age">Edad</label>
        <input
          id="patient-age"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          value={values.age}
          onChange={(event) => patch({ age: event.target.value === '' ? '' : Number(event.target.value) })}
        />
      </div>
      <div className="form-section">
        <label htmlFor="patient-height">
          Estatura (cm){requireHeight ? ' *' : ''}
        </label>
        <input
          id="patient-height"
          type="number"
          inputMode="numeric"
          min={50}
          max={230}
          required={requireHeight}
          value={values.height}
          onChange={(event) => patch({ height: event.target.value === '' ? '' : Number(event.target.value) })}
        />
      </div>
      <div className="form-section">
        <label htmlFor="patient-weight">Peso (kg)</label>
        <input
          id="patient-weight"
          type="number"
          inputMode="decimal"
          min={15}
          max={300}
          step={0.1}
          value={values.weight}
          onChange={(event) => patch({ weight: event.target.value === '' ? '' : Number(event.target.value) })}
        />
      </div>
      <div className="form-section">
        <label htmlFor="patient-sex">Sexo</label>
        <select
          id="patient-sex"
          value={values.sex}
          onChange={(event) => patch({ sex: event.target.value as PatientBiometricsValues['sex'] })}
        >
          <option value="other">No especificado</option>
          <option value="female">Femenino</option>
          <option value="male">Masculino</option>
        </select>
      </div>
      {showClinicalNote && onClinicalNoteChange && (
        <div className="form-section">
          <label htmlFor="patient-note">Comentario clínico</label>
          <textarea
            id="patient-note"
            rows={4}
            style={{ minHeight: '120px' }}
            value={clinicalNote}
            onChange={(event) => onClinicalNoteChange(event.target.value)}
            placeholder="Observaciones, plan de seguimiento, indicaciones."
          />
        </div>
      )}
    </>
  );
}
