# Events & Clinical Export QA Checklist

## Objetivo
Validar que la pantalla `Events` produce datos clínicamente útiles y exportables para OpenSim/Visual3D/AnyBody con trazabilidad completa.

## Flujo manual recomendado

1. **Carga de clip**
   - Cargar un video de 10-20 s con al menos 4-6 ciclos observables.
   - Confirmar que se muestran puntos corporales y timeline.

2. **Revisión de eventos**
   - Verificar que se pueden crear eventos manuales con tipo y lado.
   - Corregir 2-3 tags de tipo (ej. IC -> TO) y confirmar eventos.
   - Rechazar al menos un evento y confirmar que ya no bloquea el flujo.

3. **Validación clínica**
   - Revisar bloque de `issues` y `warnings`.
   - Confirmar que la app exige mínimo de contactos por lado.
   - Confirmar que eventos fuera de duración o duplicados aparecen con `qualityFlags`.

4. **OGS y observación**
   - Dejar OGS incompleto y verificar advertencia no bloqueante.
   - Completar OGS y comprobar que se persiste al continuar.

5. **Resultados preliminares**
   - Verificar panel de hallazgos sugeridos en `Events`.
   - Confirmar coherencia entre eventos corregidos y métricas preliminares.

6. **Exportación clínica**
   - Exportar `.TRC`, `.MOT`, `.C3D` y `sidecar JSON`.
   - Confirmar que:
     - TRC refleja modo de coordenadas (`yup_m` o `zup_mm`).
     - MOT contiene metadata (`grf_source`, `events_used`, `warning` cuando aplique).
     - Sidecar incluye eventos, validación, ciclos y metadata de escala.

7. **Consistencia de escala**
   - Revisar que `groundWidthMeters` está presente en la solicitud de C3D.
   - Confirmar coherencia de escala entre TRC/C3D en una muestra de coordenadas.

## Criterios de aceptación rápidos

- `Events` ya no es solo una lista de timestamps: permite tag clínico, estado de revisión y notas.
- Las correcciones humanas no se sobrescriben al sincronizar eventos automáticos.
- El botón de continuar depende de validación clínica real.
- El bundle de exportación incluye sidecar trazable para interoperabilidad.
