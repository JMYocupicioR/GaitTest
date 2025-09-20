# Integración con Supabase para Análisis Longitudinal

Este documento explica cómo configurar y usar la nueva funcionalidad de almacenamiento persistente y análisis longitudinal integrada con Supabase.

## Configuración Inicial

### 1. Variables de Entorno

El archivo `.env` ya está configurado con:
```
VITE_SUPABASE_URL=https://fyhsiickdwxuelqxwfkp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aHNpaWNrZHd4dWVscXh3ZmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDI4NzIsImV4cCI6MjA3MzkxODg3Mn0.ah2ETKKSe_tmHgn4tEf5Q63tAjk25hdGSwvqLgnIxTw
```

### 2. Configuración de la Base de Datos

1. Ve a tu proyecto de Supabase en https://supabase.com
2. Abre el SQL Editor
3. Ejecuta el script `database_setup.sql` para crear las tablas necesarias

## Funcionalidades Implementadas

### 1. Almacenamiento de Sesiones

- **Ubicación**: Pantalla de Resultados
- **Función**: Botón "Guardar sesión en base de datos"
- **Datos guardados**:
  - Sesión completa en formato JSON
  - Métricas extraídas para consultas rápidas
  - Datos en formato CSV compatible con tu archivo de análisis
  - Puntuaciones OGS si están disponibles

### 2. Búsqueda de Pacientes

- **Ubicación**: Pantalla de Resultados, sección "Análisis Longitudinal"
- **Función**: Campo de búsqueda para encontrar pacientes existentes
- **Características**:
  - Búsqueda por nombre o ID de paciente
  - Autocompletado con resultados en tiempo real
  - Muestra fecha de última sesión

### 3. Análisis Longitudinal

- **Función**: Visualización de evolución temporal de pacientes
- **Características**:
  - Resumen de tendencias (velocidad, cadencia, calidad OGS)
  - Identificación automática de mejoras y áreas de atención
  - Historial completo de sesiones
  - Cálculo de porcentajes de cambio entre primera y última sesión

### 4. Exportación CSV

- **Función**: Descarga de datos en formato CSV compatible
- **Formato**: Coincide exactamente con el archivo `informacionparaelanalisis.csv`
- **Columnas incluidas**:
  ```
  Patient_ID,examid,side,HipFlex_IC,HipRot_mean,KneeFlex_meanStance,
  KneeFlex_maxExtension,dxmod,dxside,faq,gmfcs,age,height,mass,
  cadence,speed,steplen,leglen,bmi,speedNorm,steplenNorm,cadenceNorm
  ```

## Estructura de la Base de Datos

### Tabla: `session_records`
- Almacena sesiones completas con datos JSON
- Métricas extraídas para consultas rápidas
- Información del paciente desnormalizada

### Tabla: `gait_analysis_records`
- Registros individuales en formato CSV
- Una fila por lado (L/R) por examen
- Compatible con análisis estadísticos externos

### Vista: `longitudinal_analysis`
- Resumen por paciente para análisis rápido
- Métricas agregadas de todas las sesiones

## Flujo de Trabajo

1. **Captura y Análisis**: El usuario completa una sesión de análisis normal
2. **Guardado**: En la pantalla de resultados, hace clic en "Guardar sesión"
3. **Búsqueda**: Para ver evolución, busca el paciente en el campo de búsqueda
4. **Análisis**: El sistema muestra automáticamente tendencias y cambios
5. **Exportación**: Puede descargar los datos en formato CSV para análisis externos

## Características del Análisis Longitudinal

### Métricas Rastreadas
- **Velocidad de marcha**: Cambio porcentual entre sesiones
- **Cadencia**: Evolución de pasos por minuto
- **Calidad OGS**: Puntuación observacional si está disponible
- **Detección de patologías**: Historial de hallazgos

### Interpretación Automática
- **Mejoras**: Incrementos >5% en velocidad, >3% en cadencia, >10 puntos en OGS
- **Preocupaciones**: Decrementos significativos en métricas clave
- **Tendencias**: Análisis del periodo completo de seguimiento

## Consideraciones Técnicas

### Seguridad
- Utiliza las políticas de seguridad de Supabase
- Clave anónima para operaciones básicas
- Los datos se almacenan encriptados en Supabase

### Rendimiento
- Índices en campos clave para búsquedas rápidas
- Métricas desnormalizadas para consultas eficientes
- Datos JSON comprimidos automáticamente

### Escalabilidad
- Estructura preparada para grandes volúmenes de datos
- Particionado futuro por fecha si es necesario
- Optimizado para consultas longitudinales frecuentes

## Solución de Problemas

### Error de Conexión
- Verificar variables de entorno en `.env`
- Confirmar que el proyecto Supabase está activo
- Revisar la clave API en el dashboard de Supabase

### Errores de Base de Datos
- Ejecutar nuevamente el script `database_setup.sql`
- Verificar permisos en el proyecto Supabase
- Revisar logs en el dashboard de Supabase

### Datos Faltantes
- Los campos cinemáticos están como placeholders
- Se pueden agregar cuando esté disponible el análisis cinemático completo
- Los datos básicos (velocidad, cadencia) se guardan correctamente

## Próximos Pasos

1. **Análisis Cinemático**: Integrar datos de ángulos articulares cuando estén disponibles
2. **Reportes Automatizados**: Generar reportes PDF con análisis longitudinal
3. **Alertas**: Notificaciones automáticas de cambios significativos
4. **Comparación con Normativas**: Integrar datos normativos para comparación