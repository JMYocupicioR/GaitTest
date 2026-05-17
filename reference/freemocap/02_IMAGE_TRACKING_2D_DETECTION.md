# FreeMoCap - Detección 2D de Puntos (Image Tracking)

> Archivo fuente: `freemocap/core_processes/process_motion_capture_videos/processing_pipeline_functions/image_tracking_pipeline_functions.py`

## Propósito

El primer paso del pipeline es detectar landmarks 2D en cada frame de cada cámara.
Utiliza `skellytracker` (basado en MediaPipe/YOLO) para identificar puntos anatómicos
en las imágenes de video.

## Función Principal

```python
def run_image_tracking_pipeline(
    processing_parameters: ProcessingParameterModel,
    kill_event: multiprocessing.Event,
    queue: multiprocessing.Queue,
    use_tqdm: bool,
) -> np.ndarray:
```

### Lógica:
1. Si `run_image_tracking = False`: carga datos 2D pre-existentes desde `.npy`
2. Si `run_image_tracking = True`: ejecuta detección en todos los videos sincronizados

### Resultado:
- Array NumPy con shape: `[numCams, numFrames, numTrackedPts, XYZ]`
  - `XYZ` en 2D = `[x_pixel, y_pixel, confidence]`

## Detección de Esqueleto 2D

```python
def run_image_tracking(
    model_info: ModelInfo,
    tracking_params: BaseTrackingParams,
    synchronized_videos_folder_path: Path,
    output_data_folder_path: Path,
    kill_event: multiprocessing.Event = None,
    use_tqdm: bool = True,
):
```

### Proceso Interno:
1. Selecciona el tracker según `model_info` (MediaPipe, YOLO+MediaPipe combo, etc.)
2. Si `use_yolo_crop_method = True`: usa YOLO para detectar persona → recorta → aplica MediaPipe
3. Procesa la carpeta de videos sincronizados via `process_folder_of_videos()`
4. Cada video se procesa frame por frame detectando landmarks
5. Los resultados se guardan como arrays NumPy

### Puntos Tracked (MediaPipe Pose - 33 landmarks):
```
0: nose
1: left_eye_inner
2: left_eye
3: left_eye_outer
4: right_eye_inner
5: right_eye
6: right_eye_outer
7: left_ear
8: right_ear
9: mouth_left
10: mouth_right
11: left_shoulder
12: right_shoulder
13: left_elbow
14: right_elbow
15: left_wrist
16: right_wrist
17: left_pinky
18: right_pinky
19: left_index
20: right_index
21: left_thumb
22: right_thumb
23: left_hip
24: right_hip
25: left_knee
26: right_knee
27: left_ankle
28: right_ankle
29: left_heel
30: right_heel
31: left_foot_index
32: right_foot_index
```

## Landmarks Críticos para Análisis de Marcha

| Landmark | Índice | Relevancia para Marcha |
|----------|--------|----------------------|
| left_hip | 23 | Centro de rotación de cadera |
| right_hip | 24 | Centro de rotación de cadera |
| left_knee | 25 | Flexión/extensión rodilla |
| right_knee | 26 | Flexión/extensión rodilla |
| left_ankle | 27 | Dorsiflexión/plantarflexión |
| right_ankle | 28 | Dorsiflexión/plantarflexión |
| left_heel | 29 | Contacto inicial (heel strike) |
| right_heel | 30 | Contacto inicial (heel strike) |
| left_foot_index | 31 | Despegue del pie (toe-off) |
| right_foot_index | 32 | Despegue del pie (toe-off) |

## Validación

Después de la detección, se valida que:
- El shape del array sea consistente con el número de videos y frames
- La detección sea válida (no todo NaN)
