# Referencia Ejecutiva de Exportación C3D

Basado en `.C3D.md`, estas son las reglas críticas aplicadas:

1. **Header y precisión**
   - C3D binario estándar
   - `POINT:SCALE = -1.0` para float32
   - `POINT:UNITS = "mm"`
2. **Coordenadas**
   - C3D interno: Right-Handed, Z-Up, mm
   - Conversión OpenSim: Y-Up, m
3. **Parámetros mínimos**
   - `POINT:USED`
   - `POINT:RATE`
   - `POINT:LABELS`
   - `POINT:UNITS`
4. **Interoperabilidad**
   - `.TRC` y `.MOT` en paralelo para OpenSim
   - `.C3D` para Visual3D/BTK/Mokka

## Implementación en GaitTest

- Servicio Python: `services/c3d-exporter/app/c3d_builder.py`
- Endpoint de exportación: `services/c3d-exporter/app/main.py`
- Proxy autenticado en Supabase: `supabase/functions/export-c3d/index.ts`
- Panel UI: `src/components/ClinicalExportPanel.tsx`
