-- COPIAR Y PEGAR ESTE CÓDIGO EN EL SQL EDITOR DE SUPABASE
-- URL: https://supabase.com/dashboard/project/fyhsiickdwxuelqxwfkp/sql

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

-- Insertar registro de prueba para verificar funcionamiento
INSERT INTO session_records (
  patient_id,
  exam_id,
  session_date,
  session_data,
  patient_name
) VALUES (
  'test_setup',
  'initial_test',
  CURRENT_DATE,
  '{"setup": true, "message": "Tablas creadas correctamente"}',
  'Prueba de Configuración'
) ON CONFLICT (patient_id, exam_id) DO NOTHING;

-- Verificar que las tablas fueron creadas
SELECT 'gait_analysis_records' as table_name, COUNT(*) as record_count FROM gait_analysis_records
UNION ALL
SELECT 'session_records' as table_name, COUNT(*) as record_count FROM session_records;