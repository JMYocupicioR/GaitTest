# FreeMoCap - Triangulación 3D

> Archivo fuente: `freemocap/core_processes/capture_volume_calibration/triangulate_3d_data.py`
> y `freemocap/core_processes/process_motion_capture_videos/processing_pipeline_functions/triangulation_pipeline_functions.py`

## Propósito

Convertir las detecciones 2D de múltiples cámaras en coordenadas 3D reales
mediante triangulación estéreo, usando la calibración de cámaras (Anipose/OpenCV).

## Función Principal

```python
def triangulate_3d_data(
    anipose_calibration_object: CameraGroup,
    image_2d_data: np.ndarray,           # [numCams, numFrames, numPoints, XY]
    use_triangulate_ransac: bool = False,
    use_triangulate_outlier_rejection: bool = False,
    minimum_cameras_for_triangulation: int = 2,
    maximum_cameras_to_drop: int = 1,
    target_reprojection_error: float = 0.01,
    kill_event: multiprocessing.Event = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, Optional[np.ndarray]]:
```

## Algoritmo de Triangulación

### 1. Preparación de Datos
```python
# Reshape: colapsa frames y puntos en una dimensión flat
# [numCams, numFrames, numPoints, 2] → [numCams, numFrames*numPoints, 2]
data2d_flat = image_2d_data.reshape(number_of_cameras, -1, 2)
```

### 2. Métodos de Triangulación

#### Método Simple (`triangulate`)
- Usa Direct Linear Transform (DLT)
- Requiere mínimo 2 cámaras viendo el mismo punto
- Rápido pero sensible a outliers

#### Método con Rechazo de Outliers (`triangulate_using_outlier_rejection`)
- Evalúa combinaciones de cámaras
- Descarta cámaras con alto error de reproyección
- Parámetros:
  - `minimum_cameras_for_triangulation`: mínimo de cámaras necesarias (default: 2)
  - `maximum_cameras_to_drop`: máximo de cámaras a descartar (default: 1)
  - `target_reprojection_error`: error objetivo aceptable (default: 0.01)
- Retorna pesos normalizados por cámara

### 3. Error de Reproyección
```python
# Calcula cuánto se desvía la reproyección 3D→2D de la detección original
data3d_reprojectionError_flat = anipose_calibration_object.reprojection_error(
    data3d_flat, data2d_flat, mean=True
)
```

### 4. Resultado
```python
# Reshape de vuelta a estructura temporal
spatial_data3d[numFrames, numTrackedPoints, XYZ]  # Coordenadas 3D
reprojection_error[numFrames, numTrackedPoints]    # Error por punto/frame
reprojection_error_per_cam[numCams, numFrames, numTrackedPoints]  # Error por cámara
```

## Caso Especial: Cámara Única

Cuando solo hay 1 cámara:
- No se puede triangular (necesita >= 2 vistas)
- Se usa `process_single_camera_skeleton_data()`
- Opcionalmente proyecta a un plano Z fijo (2.5D)

## Calibración de Cámaras (Anipose)

La calibración se carga desde un archivo TOML que contiene:
- Matrices intrínsecas de cada cámara (focal length, center, distortion)
- Matrices extrínsecas (rotación y traslación relativa entre cámaras)
- Se genera previamente grabando un patrón de calibración (tablero de ajedrez)

## Importancia para Análisis de Marcha

La triangulación 3D es fundamental porque:
1. Proporciona coordenadas espaciales reales (en milímetros)
2. Permite calcular ángulos articulares verdaderos (no proyecciones 2D)
3. El error de reproyección indica calidad de la reconstrucción
4. Con rechazo de outliers se mejora la robustez ante oclusiones parciales
