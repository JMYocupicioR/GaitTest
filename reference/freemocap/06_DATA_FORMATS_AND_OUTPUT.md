# FreeMoCap - Formatos de Datos y Salidas

## Estructura de Carpetas de una Grabación

```
recording_session/
├── synchronized_videos/          # Videos sincronizados (input)
│   ├── cam_00.mp4
│   ├── cam_01.mp4
│   └── cam_02.mp4
├── output_data/
│   ├── raw_data/
│   │   ├── mediapipe_body_3d_xyz.npy         # 3D crudo [frames, 33, 3]
│   │   ├── mediapipe_body_3d_reprojection_error.npy
│   │   ├── mediapipe_2dData_numCams_numFrames_numTrackedPoints_pixelXY.npy
│   │   └── ...
│   ├── center_of_mass/
│   │   ├── segmentCOM_frame_joint_xyz.npy    # COM por segmento
│   │   └── total_body_center_of_mass_xyz.npy # COM total [frames, 3]
│   ├── rigid_bones/
│   │   └── mediapipe_body_rigid_bones_3d.npy # Con huesos rígidos
│   └── ...
├── calibration_data/
│   └── camera_calibration_data.toml          # Calibración Anipose
└── annotated_videos/                          # Videos con overlay de skeleton
```

## Arrays NumPy Principales

### 1. Datos 2D (input del tracking)
```python
# Shape: [num_cameras, num_frames, num_tracked_points, 3]
# Donde dim 3 = [x_pixel, y_pixel, confidence]
data_2d = np.load("mediapipe_2dData_numCams_numFrames_numTrackedPoints_pixelXY.npy")
```

### 2. Datos 3D Crudos (post-triangulación)
```python
# Shape: [num_frames, num_tracked_points, 3]
# Donde dim 3 = [X_mm, Y_mm, Z_mm] en coordenadas del mundo
raw_3d = np.load("mediapipe_body_3d_xyz.npy")
```

### 3. Error de Reproyección
```python
# Shape: [num_frames, num_tracked_points]
# Valores en píxeles - indica calidad de la triangulación
reprojection_error = np.load("mediapipe_body_3d_reprojection_error.npy")
```

### 4. Datos 3D Procesados (post-filtrado)
```python
# Shape: [num_frames, num_tracked_points, 3]
# Interpolado + filtrado Butterworth
processed_3d = np.load("mediapipe_body_3d_xyz_processed.npy")
```

### 5. Centro de Masa
```python
# Total body COM - Shape: [num_frames, 3]
total_com = np.load("total_body_center_of_mass_xyz.npy")

# Segment COM - Shape: [num_frames, num_segments, 3]
segment_com = np.load("segmentCOM_frame_joint_xyz.npy")
```

### 6. Huesos Rígidos
```python
# Shape: [num_frames, num_tracked_points, 3]
# Datos con longitudes de huesos constantes
rigid = np.load("mediapipe_body_rigid_bones_3d.npy")
```

## Acceso a Datos para Análisis de Marcha

### Extraer trayectoria de un landmark específico:
```python
import numpy as np

# Cargar datos procesados
skeleton_3d = np.load("path/to/mediapipe_body_3d_xyz.npy")

# Índices de landmarks para marcha
LEFT_ANKLE = 27
RIGHT_ANKLE = 28
LEFT_HEEL = 29
RIGHT_HEEL = 30
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26

# Trayectoria del tobillo izquierdo a lo largo del tiempo
left_ankle_trajectory = skeleton_3d[:, LEFT_ANKLE, :]  # [frames, 3]

# Altura del talón (para detectar heel strike)
left_heel_height = skeleton_3d[:, LEFT_HEEL, 2]  # Componente Z (vertical)
right_heel_height = skeleton_3d[:, RIGHT_HEEL, 2]

# Velocidad vertical del talón (para eventos de marcha)
dt = 1/30  # Si el video es a 30 fps
left_heel_velocity = np.diff(left_heel_height) / dt
```

### Calcular ángulo de rodilla:
```python
def calculate_joint_angle(proximal, center, distal):
    """Calcula el ángulo en la articulación central (en grados)"""
    v1 = proximal - center  # Vector proximal
    v2 = distal - center    # Vector distal
    
    cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    cos_angle = np.clip(cos_angle, -1, 1)
    
    return np.degrees(np.arccos(cos_angle))

# Ángulo de rodilla izquierda por frame
knee_angles = []
for frame in range(skeleton_3d.shape[0]):
    hip = skeleton_3d[frame, LEFT_HIP]
    knee = skeleton_3d[frame, LEFT_KNEE]
    ankle = skeleton_3d[frame, LEFT_ANKLE]
    
    angle = calculate_joint_angle(hip, knee, ankle)
    knee_angles.append(angle)

knee_angles = np.array(knee_angles)
```

## Exportación

FreeMoCap también exporta a:
- **CSV**: Para análisis en Excel/R/MATLAB
- **Blender**: Via addon para visualización 3D animada
- **BVH**: Formato estándar de motion capture
