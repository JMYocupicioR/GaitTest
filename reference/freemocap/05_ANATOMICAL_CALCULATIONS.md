# FreeMoCap - Cálculos Anatómicos

> Archivos fuente:
> - `freemocap/core_processes/post_process_skeleton_data/calculate_center_of_mass.py`
> - `freemocap/core_processes/post_process_skeleton_data/enforce_rigid_bones.py`
> - `freemocap/core_processes/process_motion_capture_videos/processing_pipeline_functions/anatomical_data_pipeline_functions.py`

## Pipeline de Datos Anatómicos

```python
def calculate_anatomical_data(processing_parameters, skel3d_frame_marker_xyz, queue):
    # 1. Crear modelo esquelético
    skeleton = create_skeleton_model(
        actual_markers=...,
        segment_connections=...,
        virtual_markers=...,
        joint_hierarchy=...,
        center_of_mass_info=...,
    )
    
    # 2. Integrar datos 3D en el modelo
    skeleton.integrate_freemocap_3d_data(skel3d_frame_marker_xyz)
    
    # 3. Calcular centro de masa
    segment_COM, totalBodyCOM = calculate_center_of_mass_from_skeleton(skeleton)
    
    # 4. Enforcer huesos rígidos
    rigid_bones_data = enforce_rigid_bones_from_skeleton(skeleton)
    
    return {"segment_COM": ..., "total_body_COM": ..., "rigid_bones_data": ...}
```

---

## 1. Centro de Masa (COM) por Segmento

### Concepto
Cada segmento corporal (muslo, pierna, brazo, etc.) tiene un centro de masa
localizado a un porcentaje específico de la distancia entre su articulación
proximal y distal, según tablas antropométricas.

### Cálculo
```python
def calculate_all_segments_com(segment_positions, center_of_mass_definitions):
    for segment_name, segment_info in center_of_mass_definitions.items():
        proximal = segment_positions[segment_name]["proximal"]
        distal = segment_positions[segment_name]["distal"]
        
        com_length = segment_info.segment_com_length  # % desde proximal
        
        # Interpolación lineal entre proximal y distal
        segment_com = proximal + (distal - proximal) * com_length
```

### Datos Antropométricos (Winter, 2009)
| Segmento | COM desde proximal (%) | Masa relativa (%) |
|----------|----------------------|-------------------|
| Cabeza | 50.0 | 8.1 |
| Tronco | 50.0 | 49.7 |
| Brazo superior | 43.6 | 2.8 |
| Antebrazo | 43.0 | 1.6 |
| Mano | 50.6 | 0.6 |
| Muslo | 43.3 | 10.0 |
| Pierna | 43.3 | 4.65 |
| Pie | 50.0 | 1.45 |

---

## 2. Centro de Masa Total del Cuerpo

### Concepto
El COM total es la media ponderada por masa de todos los COM segmentarios.

### Cálculo
```python
def calculate_total_body_center_of_mass(segment_com_data, center_of_mass_definitions, num_frames):
    total_body_com = np.zeros((num_frames, 3))
    
    for segment_name, segment_info in center_of_mass_definitions.items():
        segment_com = segment_com_data[segment_name]
        segment_mass_percentage = segment_info.segment_com_percentage
        
        total_body_com += segment_com * segment_mass_percentage
    
    return total_body_com  # shape: [num_frames, 3]
```

### Importancia para Marcha
- El desplazamiento del COM indica eficiencia energética de la marcha
- Oscilación vertical del COM: ~5 cm en marcha normal
- Oscilación lateral del COM: ~2-4 cm en marcha normal
- Desviaciones indican patologías (marcha antálgica, Trendelenburg, etc.)

---

## 3. Enforcement de Huesos Rígidos

### Problema
La detección frame-a-frame puede producir variaciones en la longitud
de los segmentos (huesos) que anatómicamente deben ser constantes.

### Solución
```python
def enforce_rigid_bones(marker_data, segment_connections, bone_lengths_and_statistics, joint_hierarchy):
    """
    1. Calcula la longitud mediana de cada hueso a lo largo de todos los frames
    2. Para cada frame donde la longitud difiere de la mediana:
       - Ajusta la posición del marcador distal
       - Propaga el ajuste recursivamente a todos los hijos en la jerarquía
    """
    for segment_name, stats in bone_lengths_and_statistics.items():
        desired_length = stats["median"]
        
        for frame_index, current_length in enumerate(lengths):
            if current_length != desired_length:
                # Calcula dirección del hueso (proximal → distal)
                direction = distal_position - proximal_position
                direction /= np.linalg.norm(direction)  # normalizar
                
                # Ajuste necesario
                adjustment = (desired_length - current_length) * direction
                
                # Aplica al marcador distal
                rigid_marker_data[distal_marker][frame_index] += adjustment
                
                # Propaga a hijos (recursivo)
                adjust_children(distal_marker, frame_index, adjustment, ...)
```

### Cálculo de Estadísticas de Huesos
```python
def calculate_bone_lengths_and_statistics(marker_data, segment_connections):
    for segment_name, segment in segment_connections.items():
        proximal = marker_data[segment.proximal]
        distal = marker_data[segment.distal]
        
        lengths = np.linalg.norm(distal - proximal, axis=1)
        valid_lengths = lengths[~np.isnan(lengths)]
        
        median_length = np.median(valid_lengths)
        stdev_length = np.std(valid_lengths)
```

### Jerarquía Articular
El ajuste se propaga siguiendo la cadena cinemática:
```
hip → knee → ankle → heel / foot_index
shoulder → elbow → wrist → fingers
```
Si ajustas la rodilla, el tobillo y el pie también se mueven.

---

## Importancia para Análisis de Marcha

1. **COM**: Permite evaluar balance, simetría y eficiencia de la marcha
2. **Huesos rígidos**: Garantiza que las longitudes de segmento sean anatómicamente consistentes
3. **Segmentos**: Base para calcular ángulos articulares (flexión de rodilla, dorsiflexión, etc.)
