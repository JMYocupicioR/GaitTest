# FreeMoCap - Arquitectura y Pipeline de Procesamiento

> Fuente: https://github.com/freemocap/freemocap (v1.8.2)
> Sistema gratuito de captura de movimiento sin marcadores, grado investigación

## Dependencias Clave del Ecosistema

| Paquete | Función |
|---------|---------|
| `skellytracker` | Detección 2D de landmarks en imágenes/video (MediaPipe, YOLO) |
| `skellycam` | Captura y sincronización de video multi-cámara |
| `skellyforge` | Post-procesamiento (interpolación, filtrado Butterworth, rotación) |
| `skelly_synchronize` | Sincronización temporal de múltiples streams de video |
| `aniposelib` | Calibración de cámaras y triangulación 3D |
| `opencv-contrib-python` | Procesamiento de imágenes base |

## Pipeline Principal de Procesamiento

```
┌─────────────────────────────────────────────────────────────────────┐
│                    process_recording_folder()                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. PIPELINE CHECK                                                    │
│     └─ Valida que los parámetros y archivos existan                  │
│                                                                       │
│  2. IMAGE TRACKING (2D Skeleton Detection)                           │
│     └─ run_image_tracking_pipeline()                                 │
│     └─ Resultado: image_data[numCams, numFrames, numTrackedPts, XYZ] │
│                                                                       │
│  3. TRIANGULATION (2D → 3D)                                          │
│     └─ get_triangulated_data()                                       │
│     └─ Resultado: raw_skel3d[frame, marker, xyz]                     │
│                                                                       │
│  4. POST-PROCESSING                                                   │
│     └─ post_process_data()                                           │
│     └─ Interpolación + Filtrado Butterworth + Alineación             │
│     └─ Resultado: skel3d[frame, marker, xyz] (filtrado)              │
│                                                                       │
│  5. ANATOMICAL DATA CALCULATION                                       │
│     └─ calculate_anatomical_data()                                   │
│     ├─ Centro de masa por segmento                                   │
│     ├─ Centro de masa total del cuerpo                               │
│     └─ Enforcement de huesos rígidos                                 │
│                                                                       │
│  6. DATA SAVING                                                       │
│     └─ Guarda arrays NumPy (.npy) y exporta formatos                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Estructura de Datos Clave

### Dimensiones del Array Principal
- **2D Data**: `[num_cameras, num_frames, num_tracked_points, XY(confidence)]`
- **3D Data**: `[num_frames, num_tracked_points, XYZ]`
- **Reprojection Error**: `[num_frames, num_tracked_points]`
- **Center of Mass**: `[num_frames, 3]` (XYZ del cuerpo completo)

### Modelos de Tracking Soportados
- MediaPipe Holistic (33 body + 21 hand + 468 face landmarks)
- MediaPipe Pose (33 body landmarks)
- YOLO + MediaPipe combo
- Otros trackers via `skellytracker`

## Flujo para Análisis de Marcha

Para análisis de marcha específicamente, los puntos críticos son:
1. **Detección 2D** de landmarks corporales (especialmente miembros inferiores)
2. **Triangulación 3D** para obtener coordenadas espaciales reales
3. **Filtrado temporal** (Butterworth) para suavizar trayectorias
4. **Centro de masa** para análisis de equilibrio durante la marcha
5. **Huesos rígidos** para mantener coherencia anatómica del esqueleto
