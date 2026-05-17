# Exportaciones Clínicas en GaitTest

Esta guía resume cómo usar los nuevos exportadores clínicos:

- `.TRC` para OpenSim (trayectorias de marcadores en Y-Up y metros)
- `.MOT` para OpenSim ExternalLoads
- `.C3D` para Visual3D / Vicon / BTK (vía servicio Python)

## Desde la app

1. Ejecuta una sesión completa y llega a la pantalla de reporte.
2. En **Exportación clínica**, selecciona el sistema destino.
3. Elige:
   - `Exportar .TRC`
   - `Exportar .MOT`
   - `Exportar .C3D`
   - `Exportar todo`

## Reglas críticas implementadas

- Transformación C3D Z-Up (mm) → OpenSim Y-Up (m): `X=x*0.001`, `Y=z*0.001`, `Z=-y*0.001`
- En TRC, marcadores ocluidos se exportan en blanco (no `0.0`)
- En MOT, si `Fz < 10N`, se fuerza fuerza/momento a cero y COP por defecto (sin NaN)
- C3D se escribe con `POINT:SCALE=-1.0` (float32) y `POINT:UNITS="mm"`

## Validación recomendada

1. Abrir `.C3D` en Mokka y revisar trayectorias.
2. Abrir `.TRC` en OpenSim Scale Tool y validar escala.
3. Cargar `.MOT` con ExternalLoads XML y revisar que no haya inestabilidad numérica.
