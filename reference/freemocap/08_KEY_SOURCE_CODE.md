# FreeMoCap - Código Fuente Clave (Referencia)

> Repositorio: https://github.com/freemocap/freemocap
> Versión: v1.8.2 | Licencia: AGPL-3.0

## Archivo: process_recording_folder.py
> Pipeline principal que orquesta todo el procesamiento

```python
def process_recording_folder(
    recording_processing_parameter_model: ProcessingParameterModel,
    kill_event: multiprocessing.Event = None,
    logging_queue: Optional[multiprocessing.Queue] = None,
    use_tqdm: bool = True,
) -> None:
    # 1. Validar parámetros
    processing_pipeline_check(processing_parameters=recording_processing_parameter_model)

    # 2. Detección 2D de landmarks en cada cámara
    image_data_numCams_numFrames_numTrackedPts_XYZ = run_image_tracking_pipeline(
        processing_parameters=recording_processing_parameter_model,
        kill_event=kill_event,
        queue=logging_queue,
        use_tqdm=use_tqdm,
    )

    # 3. Triangulación 2D → 3D
    raw_skel3d_frame_marker_xyz = get_triangulated_data(
        image_data_numCams_numFrames_numTrackedPts_XYZ=image_data_numCams_numFrames_numTrackedPts_XYZ,
        processing_parameters=recording_processing_parameter_model,
        kill_event=kill_event,
        queue=logging_queue,
    )

    # 4. Post-procesamiento (interpolación + filtro Butterworth)
    skel3d_frame_marker_xyz = post_process_data(
        recording_processing_parameter_model=recording_processing_parameter_model,
        raw_skel3d_frame_marker_xyz=raw_skel3d_frame_marker_xyz,
        queue=logging_queue,
    )

    # 5. Cálculos anatómicos (COM + huesos rígidos)
    anatomical_data_dict = calculate_anatomical_data(
        processing_parameters=recording_processing_parameter_model,
        skel3d_frame_marker_xyz=skel3d_frame_marker_xyz,
        queue=logging_queue,
    )

    # 6. Guardar datos
    save_data(
        skel3d_frame_marker_xyz=skel3d_frame_marker_xyz,
        segment_COM_frame_imgPoint_XYZ=anatomical_data_dict["segment_COM"],
        totalBodyCOM_frame_XYZ=anatomical_data_dict["total_body_COM"],
        rigid_bones_data=anatomical_data_dict["rigid_bones_data"],
        processing_parameters=recording_processing_parameter_model,
        queue=logging_queue,
    )
```

---

## Archivo: triangulate_3d_data.py
> Reconstrucción 3D por triangulación estéreo

```python
def triangulate_3d_data(
    anipose_calibration_object: CameraGroup,
    image_2d_data: np.ndarray,  # [numCams, numFrames, numPoints, XY]
    use_triangulate_ransac: bool = False,
    use_triangulate_outlier_rejection: bool = False,
    minimum_cameras_for_triangulation: int = 2,
    maximum_cameras_to_drop: int = 1,
    target_reprojection_error: float = 0.01,
    kill_event: multiprocessing.Event = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, Optional[np.ndarray]]:
    
    number_of_cameras = image_2d_data.shape[0]
    number_of_frames = image_2d_data.shape[1]
    number_of_tracked_points = image_2d_data.shape[2]
    
    # Colapsa frames y puntos: [numCams, numFrames*numPoints, 2]
    data2d_flat = image_2d_data.reshape(number_of_cameras, -1, 2)
    
    if use_triangulate_outlier_rejection:
        data3d_flat, weights = anipose_calibration_object.triangulate_using_outlier_rejection(
            data2d_flat,
            progress=True,
            kill_event=kill_event,
            minimum_cameras_for_triangulation=minimum_cameras_for_triangulation,
            maximum_cameras_to_drop=maximum_cameras_to_drop,
            target_reprojection_error=target_reprojection_error,
        )
    else:
        data3d_flat = anipose_calibration_object.triangulate(
            data2d_flat,
            progress=True,
            kill_event=kill_event,
            minimum_cameras_for_triangulation=minimum_cameras_for_triangulation,
        )
    
    # Reshape a [frames, points, 3]
    spatial_data3d = data3d_flat.reshape(number_of_frames, number_of_tracked_points, 3)
    
    # Calcular error de reproyección
    reprojection_error = anipose_calibration_object.reprojection_error(
        data3d_flat, data2d_flat, mean=True
    ).reshape(number_of_frames, number_of_tracked_points)
    
    return spatial_data3d, reprojection_error, ...
```

---

## Archivo: post_process_skeleton.py
> Filtrado y limpieza de datos 3D

```python
def post_process_data(
    recording_processing_parameter_model: ProcessingParameterModel,
    raw_skel3d_frame_marker_xyz: np.ndarray,
    queue: multiprocessing.Queue,
) -> np.ndarray:
    # Obtener parámetros de filtrado
    filter_sampling_rate, filter_cutoff_frequency, filter_order, run_butterworth = (
        get_settings_from_parameter_tree(recording_processing_parameter_model)
    )
    
    # Ajustar configuración de skellyforge
    adjusted_settings = adjust_default_settings(
        filter_sampling_rate, filter_cutoff_frequency, filter_order
    )
    
    # Ejecutar pipeline: INTERPOLATION → FILTERING → FIND_GOOD_FRAME → ROTATION
    processed_skeleton = run_post_processing_worker(
        raw_skel3d_frame_marker_xyz=raw_skel3d_frame_marker_xyz,
        settings_dictionary=adjusted_settings,
        landmark_names=get_landmark_names(model_info),
        run_butterworth_filter=run_butterworth,
    )
    
    return processed_skeleton  # [frames, markers, 3] filtrado
```

---

## Archivo: calculate_center_of_mass.py
> Cálculo de centro de masa segmentario y total

```python
def calculate_center_of_mass_from_skeleton(skeleton: Skeleton):
    # Obtener posiciones proximal/distal de cada segmento
    segment_3d_positions = get_all_segment_markers(skeleton)
    
    # COM de cada segmento = proximal + (distal - proximal) * com_length_percentage
    segment_com_data = calculate_all_segments_com(
        segment_3d_positions, skeleton.center_of_mass_definitions
    )
    
    # COM total = Σ (segment_com * segment_mass_percentage)
    total_body_com = calculate_total_body_center_of_mass(
        segment_com_data, skeleton.center_of_mass_definitions, skeleton.num_frames
    )
    
    return merged_segment_com_data, total_body_com
```

---

## Archivo: enforce_rigid_bones.py
> Mantener longitudes de hueso constantes

```python
def enforce_rigid_bones_from_skeleton(skeleton: Skeleton) -> np.ndarray:
    # 1. Calcular longitud mediana de cada hueso
    bone_stats = calculate_bone_lengths_and_statistics(
        marker_data=skeleton.marker_data,
        segment_connections=skeleton.segments
    )
    
    # 2. Ajustar marcadores distales para mantener longitud constante
    rigid_data = enforce_rigid_bones(
        marker_data=skeleton.marker_data,
        segment_connections=skeleton.segments,
        bone_lengths_and_statistics=bone_stats,
        joint_hierarchy=skeleton.joint_hierarchy
    )
    
    return merge_rigid_marker_data(rigid_data)
```

---

## Dependencias Principales (pyproject.toml)

```toml
dependencies = [
    "skellycam==2025.09.1097",           # Captura de video
    "skelly_viewer==2025.04.1028",       # Visualización
    "skellyforge==2024.12.1009",         # Post-procesamiento
    "skelly_synchronize==2025.04.1037",  # Sincronización
    "skellytracker[all]==2025.10.1024",  # Tracking 2D (MediaPipe/YOLO)
    "opencv-contrib-python==4.8.*",      # Visión por computadora
    "aniposelib==0.4.3",                 # Calibración + triangulación
]
```
