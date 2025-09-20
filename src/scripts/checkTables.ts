import { supabase } from '../lib/supabase.ts';

export async function checkSupabaseTables() {
  console.log('🔍 Verificando tablas en Supabase...');

  try {
    // Verificar tabla gait_analysis_records
    const { data: gaitData, error: gaitError } = await supabase
      .from('gait_analysis_records')
      .select('*')
      .limit(1);

    // Verificar tabla session_records
    const { data: sessionData, error: sessionError } = await supabase
      .from('session_records')
      .select('*')
      .limit(1);

    console.log('\n📊 RESULTADOS DE VERIFICACIÓN:');
    console.log('=====================================');

    if (!gaitError) {
      console.log('✅ Tabla "gait_analysis_records": EXISTE');
      console.log(`   Registros encontrados: ${gaitData?.length || 0}`);
    } else {
      console.log('❌ Tabla "gait_analysis_records": NO EXISTE');
      console.log(`   Error: ${gaitError.message}`);
    }

    if (!sessionError) {
      console.log('✅ Tabla "session_records": EXISTE');
      console.log(`   Registros encontrados: ${sessionData?.length || 0}`);
    } else {
      console.log('❌ Tabla "session_records": NO EXISTE');
      console.log(`   Error: ${sessionError.message}`);
    }

    // Verificar conexión general
    if (!gaitError && !sessionError) {
      console.log('\n🎉 BASE DE DATOS CONFIGURADA CORRECTAMENTE');
      console.log('   Todas las tablas están disponibles');
      return { success: true, gaitTable: true, sessionTable: true };
    } else if (gaitError && sessionError) {
      console.log('\n⚠️  BASE DE DATOS REQUIERE CONFIGURACIÓN');
      console.log('   Ninguna tabla está creada');
      console.log('\n📋 ACCIÓN REQUERIDA:');
      console.log('   1. Ve a https://supabase.com/dashboard/project/fyhsiickdwxuelqxwfkp/sql');
      console.log('   2. Copia y pega el contenido de CREATE_TABLES.sql');
      console.log('   3. Haz clic en "RUN"');
      return { success: false, gaitTable: false, sessionTable: false };
    } else {
      console.log('\n⚠️  CONFIGURACIÓN PARCIAL');
      console.log('   Solo algunas tablas están creadas');
      return {
        success: false,
        gaitTable: !gaitError,
        sessionTable: !sessionError
      };
    }

  } catch (error) {
    console.error('❌ ERROR DE CONEXIÓN:', error);
    console.log('\n🔧 POSIBLES CAUSAS:');
    console.log('   - Credenciales incorrectas en .env');
    console.log('   - Proyecto Supabase inactivo');
    console.log('   - Problemas de red');
    return { success: false, error };
  }
}

// Función adicional para obtener información detallada
export async function getTableInfo() {
  try {
    console.log('\n📈 INFORMACIÓN ADICIONAL:');
    console.log('=====================================');

    // Contar registros en cada tabla si existen
    const { count: gaitCount } = await supabase
      .from('gait_analysis_records')
      .select('*', { count: 'exact', head: true });

    const { count: sessionCount } = await supabase
      .from('session_records')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Registros en gait_analysis_records: ${gaitCount || 0}`);
    console.log(`📊 Registros en session_records: ${sessionCount || 0}`);

    // Obtener algunos registros de ejemplo si existen
    if (sessionCount && sessionCount > 0) {
      const { data: recentSessions } = await supabase
        .from('session_records')
        .select('patient_id, patient_name, session_date, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      console.log('\n📅 SESIONES RECIENTES:');
      recentSessions?.forEach((session, index) => {
        console.log(`   ${index + 1}. ${session.patient_name || session.patient_id} - ${session.session_date}`);
      });
    }

  } catch (error) {
    console.log('ℹ️  No se pudo obtener información adicional (normal si las tablas no existen)');
  }
}

// Ejecutar verificación si se importa directamente
if (typeof window !== 'undefined') {
  // En el navegador, exponer funciones globalmente para testing
  (window as any).checkSupabaseTables = checkSupabaseTables;
  (window as any).getTableInfo = getTableInfo;
}