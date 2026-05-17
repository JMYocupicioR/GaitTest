# FreeMoCap - Post-Procesamiento de Datos del Esqueleto

> Archivo fuente: `freemocap/core_processes/post_process_skeleton_data/post_process_skeleton.py`

## Propósito

Limpiar y suavizar los datos 3D crudos del esqueleto mediante:
1. Interpolación de gaps (frames faltantes)
2. Filtrado Butterworth (suavizado temporal)
3. Búsqueda de "good frame" (frame de referencia)
4. Rotación del esqueleto (alineación con plano del suelo)

## Pipeline de Post-Procesamiento

```python
def post_process_data(
    recording_processing_parameter_model: ProcessingParameterModel,
    raw_skel3d_frame_marker_xyz: np.ndarray,  # [frames, markers, 3]
    queue: multiprocessing.Queue,
) -> np.ndarray:
```

### Secuencia de Tareas (TaskWorkerThread de skellyforge):

```
TASK_INTERPOLATION → TASK_FILTERING → TASK_FINDING_GOOD_FRAME → TASK_SKELETON_ROTATION
```

## 1. Interpolación (Gap Filling)

- Rellena frames donde la detección falló (valores NaN)
- Usa interpolación lineal o spline entre puntos conocidos
- Crítico para mantener continuidad temporal en la marcha

## 2. Filtrado Butterworth (Low-pass filter)

```python
# Parámetros del filtro:
filter_sampling_rate    # Hz - framerate del video
filter_cutoff_frequency # Hz - frecuencia de corte (típicamente 6-12 Hz para marcha)
filter_order            # Orden del filtro (típicamente 4)
```

### Por qué es importante para marcha:
- La marcha humana tiene componentes de frecuencia < 6-10 Hz
- Frecuencias más altas son ruido de la detección
- El filtro Butterworth preserva la fase (bidireccional)
- Suaviza trayectorias sin distorsionar eventos como heel-strike

### Parámetros Típicos para Marcha:
| Parámetro | Valor Típico | Notas |
|-----------|-------------|-------|
| Sampling rate | 30-120 Hz | Depende del framerate de la cámara |
| Cutoff frequency | 6-12 Hz | 6 Hz para marcha lenta, 12 Hz para carrera |
| Filter order | 4 | Balance entre atenuación y preservación |

## 3. Finding Good Frame

- Identifica un frame donde todos los landmarks son visibles y confiables
- Se usa como referencia para la rotación del esqueleto
- Selecciona el frame con menor cantidad de NaN y mejor distribución

## 4. Rotación del Esqueleto

- Alinea el esqueleto con un sistema de referencia global
- Opcionalmente rota para que el plano del suelo sea horizontal
- En el contexto de FreeMoCap: `PARAM_ROTATE_DATA = False` (deshabilitado por defecto)

## Configuración de Parámetros

```python
def get_settings_from_parameter_tree(recording_processing_parameter_model):
    rec = recording_processing_parameter_model
    
    filter_sampling_rate = rec.post_processing_parameters_model.framerate
    filter_cutoff_frequency = rec.post_processing_parameters_model.butterworth_filter_parameters.cutoff_frequency
    filter_order = rec.post_processing_parameters_model.butterworth_filter_parameters.order
    run_butterworth_filter = rec.post_processing_parameters_model.run_butterworth_filter
    
    return filter_sampling_rate, filter_cutoff_frequency, filter_order, run_butterworth_filter
```

## Resultado

- Array NumPy procesado: `[num_frames, num_markers, 3]` (XYZ suavizado)
- Los gaps están interpolados
- El ruido de alta frecuencia está filtrado
- Listo para cálculos anatómicos (ángulos, centro de masa)
