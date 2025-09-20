-- Script de inicialización de la base de datos para GaitTest
-- Ejecutar en Supabase SQL Editor

-- Tabla para registros de análisis de marcha (formato CSV)
CREATE TABLE IF NOT EXISTS gait_analysis_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  side TEXT CHECK (side IN ('L', 'R')) NOT NULL,

  -- Datos cinemáticos
  hip_flex_ic DECIMAL,
  hip_rot_mean DECIMAL,
  knee_flex_mean_stance DECIMAL,
  knee_flex_max_extension DECIMAL,

  -- Datos clínicos
  dx_mod TEXT,
  dx_side TEXT,
  faq INTEGER,
  gmfcs INTEGER,

  -- Características del paciente
  age INTEGER,
  height DECIMAL,
  mass DECIMAL,

  -- Parámetros de marcha
  cadence DECIMAL,
  speed DECIMAL,
  step_len DECIMAL,
  leg_len DECIMAL,
  bmi DECIMAL,
  speed_norm DECIMAL,
  step_len_norm DECIMAL,
  cadence_norm DECIMAL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(patient_id, exam_id, side)
);

-- Tabla para registros completos de sesiones
CREATE TABLE IF NOT EXISTS session_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  session_date DATE NOT NULL,

  -- Datos completos de la sesión como JSON
  session_data JSONB NOT NULL,

  -- Métricas extraídas para indexación y consultas rápidas
  duration_seconds INTEGER,
  steps INTEGER,
  distance_meters DECIMAL,
  avg_speed DECIMAL,
  cadence DECIMAL,

  -- Puntuaciones OGS
  ogs_left_total INTEGER,
  ogs_right_total INTEGER,
  ogs_quality_index DECIMAL,
  ogs_asymmetry_index DECIMAL,

  -- Resultados del análisis
  pathology_detected BOOLEAN DEFAULT FALSE,
  primary_pathology TEXT,
  pathology_confidence DECIMAL,

  -- Información del paciente (desnormalizada para acceso rápido)
  patient_name TEXT,
  patient_age INTEGER,
  patient_height DECIMAL,
  patient_weight DECIMAL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(patient_id, exam_id)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_gait_records_patient ON gait_analysis_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_gait_records_exam ON gait_analysis_records(exam_id);
CREATE INDEX IF NOT EXISTS idx_gait_records_created ON gait_analysis_records(created_at);

CREATE INDEX IF NOT EXISTS idx_session_records_patient ON session_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_session_records_date ON session_records(session_date);
CREATE INDEX IF NOT EXISTS idx_session_records_created ON session_records(created_at);
CREATE INDEX IF NOT EXISTS idx_session_records_pathology ON session_records(pathology_detected);

-- Habilitar RLS (Row Level Security) si es necesario
-- ALTER TABLE gait_analysis_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE session_records ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad básicas (opcional)
-- CREATE POLICY "Allow authenticated users" ON gait_analysis_records FOR ALL TO authenticated;
-- CREATE POLICY "Allow authenticated users" ON session_records FOR ALL TO authenticated;

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_gait_analysis_records_updated_at
    BEFORE UPDATE ON gait_analysis_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_records_updated_at
    BEFORE UPDATE ON session_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Vista para análisis longitudinal simplificado
CREATE OR REPLACE VIEW longitudinal_analysis AS
SELECT
    sr.patient_id,
    sr.patient_name,
    COUNT(*) as total_sessions,
    MIN(sr.session_date) as first_session,
    MAX(sr.session_date) as last_session,
    AVG(sr.avg_speed) as avg_speed_overall,
    AVG(sr.cadence) as avg_cadence_overall,
    AVG(sr.ogs_quality_index) as avg_ogs_quality,
    COUNT(CASE WHEN sr.pathology_detected THEN 1 END) as sessions_with_pathology
FROM session_records sr
GROUP BY sr.patient_id, sr.patient_name;

-- Comentarios para documentación
COMMENT ON TABLE gait_analysis_records IS 'Registros individuales de análisis de marcha en formato compatible con CSV de investigación';
COMMENT ON TABLE session_records IS 'Registros completos de sesiones de análisis de marcha para seguimiento longitudinal';
COMMENT ON VIEW longitudinal_analysis IS 'Vista resumen para análisis longitudinal rápido por paciente';