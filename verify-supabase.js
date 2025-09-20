// Script independiente para verificar tablas de Supabase
// Ejecutar con: node verify-supabase.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Leer variables de entorno del archivo .env
let supabaseUrl, supabaseKey;
try {
  const envContent = readFileSync('.env', 'utf8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1];
    }
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseKey = line.split('=')[1];
    }
  }
} catch (error) {
  console.error('❌ Error leyendo archivo .env');
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no encontradas');
  console.log('Asegúrate de que .env contiene:');
  console.log('VITE_SUPABASE_URL=...');
  console.log('VITE_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log('🔍 VERIFICANDO TABLAS EN SUPABASE');
  console.log('=======================================');
  console.log(`🌐 URL: ${supabaseUrl}`);
  console.log(`🔑 Key: ${supabaseKey.substring(0, 20)}...`);
  console.log('');

  try {
    // Verificar tabla gait_analysis_records
    console.log('📊 Verificando tabla "gait_analysis_records"...');
    const { data: gaitData, error: gaitError } = await supabase
      .from('gait_analysis_records')
      .select('*')
      .limit(1);

    if (!gaitError) {
      console.log('✅ Tabla "gait_analysis_records": EXISTE');

      // Contar registros
      const { count } = await supabase
        .from('gait_analysis_records')
        .select('*', { count: 'exact', head: true });

      console.log(`   📈 Registros: ${count || 0}`);
    } else {
      console.log('❌ Tabla "gait_analysis_records": NO EXISTE');
      console.log(`   ⚠️  Error: ${gaitError.message}`);
    }

    console.log('');

    // Verificar tabla session_records
    console.log('📊 Verificando tabla "session_records"...');
    const { data: sessionData, error: sessionError } = await supabase
      .from('session_records')
      .select('*')
      .limit(1);

    if (!sessionError) {
      console.log('✅ Tabla "session_records": EXISTE');

      // Contar registros
      const { count } = await supabase
        .from('session_records')
        .select('*', { count: 'exact', head: true });

      console.log(`   📈 Registros: ${count || 0}`);

      // Mostrar registros recientes si existen
      if (count && count > 0) {
        const { data: recentSessions } = await supabase
          .from('session_records')
          .select('patient_id, patient_name, session_date, created_at')
          .order('created_at', { ascending: false })
          .limit(5);

        console.log('   📅 Sesiones recientes:');
        recentSessions?.forEach((session, index) => {
          const date = new Date(session.created_at).toLocaleDateString('es-ES');
          console.log(`      ${index + 1}. ${session.patient_name || session.patient_id} - ${session.session_date} (${date})`);
        });
      }
    } else {
      console.log('❌ Tabla "session_records": NO EXISTE');
      console.log(`   ⚠️  Error: ${sessionError.message}`);
    }

    console.log('');
    console.log('=======================================');

    // Resumen final
    if (!gaitError && !sessionError) {
      console.log('🎉 RESULTADO: BASE DE DATOS CONFIGURADA CORRECTAMENTE');
      console.log('   ✅ Todas las tablas están disponibles');
      console.log('   ✅ Sistema listo para usar');
    } else if (gaitError && sessionError) {
      console.log('⚠️  RESULTADO: BASE DE DATOS REQUIERE CONFIGURACIÓN');
      console.log('   ❌ Ninguna tabla está creada');
      console.log('');
      console.log('📋 ACCIÓN REQUERIDA:');
      console.log('   1. Ve a: https://supabase.com/dashboard/project/fyhsiickdwxuelqxwfkp/sql');
      console.log('   2. Copia y pega el contenido de CREATE_TABLES.sql');
      console.log('   3. Haz clic en "RUN"');
      console.log('   4. Vuelve a ejecutar este script para verificar');
    } else {
      console.log('⚠️  RESULTADO: CONFIGURACIÓN PARCIAL');
      console.log('   🔄 Solo algunas tablas están creadas');
      console.log('   📋 Ejecuta el script CREATE_TABLES.sql completo');
    }

  } catch (error) {
    console.error('❌ ERROR DE CONEXIÓN:', error.message);
    console.log('');
    console.log('🔧 POSIBLES CAUSAS:');
    console.log('   - Credenciales incorrectas en .env');
    console.log('   - Proyecto Supabase inactivo');
    console.log('   - Problemas de red');
    console.log('   - URL o API Key incorrectos');
  }
}

// Ejecutar verificación
verifyTables().then(() => {
  console.log('');
  console.log('✨ Verificación completada');
}).catch((error) => {
  console.error('💥 Error en la verificación:', error);
});