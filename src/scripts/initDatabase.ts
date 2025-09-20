import { supabase } from '../lib/supabase.ts';

// Script para inicializar las tablas de la base de datos
export async function initializeDatabase() {
  console.log('Iniciando configuración de base de datos...');

  try {
    // Crear tabla de registros de análisis de marcha
    const { error: gaitTableError } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS gait_analysis_records (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          patient_id TEXT NOT NULL,
          exam_id TEXT NOT NULL,
          side TEXT CHECK (side IN ('L', 'R')) NOT NULL,
          hip_flex_ic DECIMAL,
          hip_rot_mean DECIMAL,
          knee_flex_mean_stance DECIMAL,
          knee_flex_max_extension DECIMAL,
          dx_mod TEXT,
          dx_side TEXT,
          faq INTEGER,
          gmfcs INTEGER,
          age INTEGER,
          height DECIMAL,
          mass DECIMAL,
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
      `
    });

    if (gaitTableError) {
      console.error('Error creando tabla gait_analysis_records:', gaitTableError);
    } else {
      console.log('✓ Tabla gait_analysis_records creada/verificada');
    }

    // Crear tabla de registros de sesiones
    const { error: sessionTableError } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS session_records (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          patient_id TEXT NOT NULL,
          exam_id TEXT NOT NULL,
          session_date DATE NOT NULL,
          session_data JSONB NOT NULL,
          duration_seconds INTEGER,
          steps INTEGER,
          distance_meters DECIMAL,
          avg_speed DECIMAL,
          cadence DECIMAL,
          ogs_left_total INTEGER,
          ogs_right_total INTEGER,
          ogs_quality_index DECIMAL,
          ogs_asymmetry_index DECIMAL,
          pathology_detected BOOLEAN DEFAULT FALSE,
          primary_pathology TEXT,
          pathology_confidence DECIMAL,
          patient_name TEXT,
          patient_age INTEGER,
          patient_height DECIMAL,
          patient_weight DECIMAL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(patient_id, exam_id)
        );
      `
    });

    if (sessionTableError) {
      console.error('Error creando tabla session_records:', sessionTableError);
    } else {
      console.log('✓ Tabla session_records creada/verificada');
    }

    // Crear índices
    const { error: indexError } = await supabase.rpc('sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_gait_records_patient ON gait_analysis_records(patient_id);
        CREATE INDEX IF NOT EXISTS idx_gait_records_exam ON gait_analysis_records(exam_id);
        CREATE INDEX IF NOT EXISTS idx_session_records_patient ON session_records(patient_id);
        CREATE INDEX IF NOT EXISTS idx_session_records_date ON session_records(session_date);
      `
    });

    if (indexError) {
      console.error('Error creando índices:', indexError);
    } else {
      console.log('✓ Índices creados/verificados');
    }

    // Probar conexión insertando un registro de prueba
    const testData = {
      patient_id: 'test_patient_init',
      exam_id: 'test_exam_init',
      session_date: new Date().toISOString().split('T')[0],
      session_data: { test: true },
      patient_name: 'Paciente de Prueba'
    };

    const { data: insertTest, error: insertError } = await supabase
      .from('session_records')
      .upsert(testData)
      .select();

    if (insertError) {
      console.error('Error en prueba de inserción:', insertError);
    } else {
      console.log('✓ Prueba de inserción exitosa:', insertTest);

      // Limpiar el registro de prueba
      await supabase
        .from('session_records')
        .delete()
        .eq('patient_id', 'test_patient_init');

      console.log('✓ Registro de prueba limpiado');
    }

    console.log('🎉 Base de datos inicializada correctamente!');
    return true;

  } catch (error) {
    console.error('Error general en inicialización:', error);
    return false;
  }
}

// Función alternativa para crear tablas usando SQL directo
export async function createTablesDirectly() {
  console.log('Creando tablas usando SQL directo...');

  const createGaitTable = `
    CREATE TABLE IF NOT EXISTS gait_analysis_records (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id TEXT NOT NULL,
      exam_id TEXT NOT NULL,
      side TEXT CHECK (side IN ('L', 'R')) NOT NULL,
      hip_flex_ic DECIMAL,
      hip_rot_mean DECIMAL,
      knee_flex_mean_stance DECIMAL,
      knee_flex_max_extension DECIMAL,
      dx_mod TEXT,
      dx_side TEXT,
      faq INTEGER,
      gmfcs INTEGER,
      age INTEGER,
      height DECIMAL,
      mass DECIMAL,
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
  `;

  const createSessionTable = `
    CREATE TABLE IF NOT EXISTS session_records (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id TEXT NOT NULL,
      exam_id TEXT NOT NULL,
      session_date DATE NOT NULL,
      session_data JSONB NOT NULL,
      duration_seconds INTEGER,
      steps INTEGER,
      distance_meters DECIMAL,
      avg_speed DECIMAL,
      cadence DECIMAL,
      ogs_left_total INTEGER,
      ogs_right_total INTEGER,
      ogs_quality_index DECIMAL,
      ogs_asymmetry_index DECIMAL,
      pathology_detected BOOLEAN DEFAULT FALSE,
      primary_pathology TEXT,
      pathology_confidence DECIMAL,
      patient_name TEXT,
      patient_age INTEGER,
      patient_height DECIMAL,
      patient_weight DECIMAL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(patient_id, exam_id)
    );
  `;

  try {
    const { error: error1 } = await supabase.from('_sql').select().limit(0);
    console.log('Test query result:', error1);

    // Intentar crear las tablas directamente
    const { error } = await supabase
      .rpc('exec_sql', { sql: createGaitTable });

    if (error) {
      console.log('RPC no disponible, las tablas deben crearse manualmente.');
      console.log('Por favor, ejecuta el siguiente SQL en el editor de Supabase:');
      console.log('\n--- COPY THIS SQL TO SUPABASE ---\n');
      console.log(createGaitTable);
      console.log('\n' + createSessionTable);
      console.log('\n--- END COPY ---\n');
    } else {
      console.log('✓ Tablas creadas exitosamente');
    }

  } catch (error) {
    console.log('Las tablas deben crearse manualmente en Supabase SQL Editor.');
    console.log('Error:', error);
  }
}

// Función para verificar si las tablas existen
export async function checkTables() {
  try {
    const { error: gaitError } = await supabase
      .from('gait_analysis_records')
      .select('count')
      .limit(1);

    const { error: sessionError } = await supabase
      .from('session_records')
      .select('count')
      .limit(1);

    return {
      gaitTable: !gaitError,
      sessionTable: !sessionError,
      errors: { gaitError, sessionError }
    };
  } catch (error) {
    return {
      gaitTable: false,
      sessionTable: false,
      errors: { general: error }
    };
  }
}

// Ejecutar si se llama directamente
if (typeof window !== 'undefined') {
  // Browser environment - don't auto-execute
} else {
  // Node environment - can auto-execute
  initializeDatabase();
}