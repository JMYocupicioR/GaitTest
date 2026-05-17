# FreeMoCap - Relevancia para Análisis de Marcha (Gait Analysis)

## Cómo FreeMoCap Captura los Puntos de la Marcha

### Flujo Completo para Marcha:

```
Video del paciente caminando
         │
         ▼
┌─────────────────────────┐
│  1. Detección 2D        │  skellytracker (MediaPipe)
│  33 landmarks/frame     │  Cada cámara detecta independientemente
│  30-120 fps             │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  2. Sincronización      │  skelly_synchronize
│  Alinea timestamps      │  Cross-correlation de audio/movimiento
│  entre cámaras          │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  3. Triangulación 3D    │  aniposelib (DLT + calibración)
│  Coordenadas XYZ reales │  Milímetros en espacio 3D
│  Error de reproyección  │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  4. Filtrado            │  skellyforge
│  Butterworth 4° orden   │  Cutoff: 6-12 Hz
│  + Interpolación gaps   │  Preserva fase temporal
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  5. Modelo Esquelético  │  Segmentos + Jerarquía
│  Huesos rígidos         │  Longitudes constantes
│  Centro de masa         │  Antropometría (Winter)
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  6. Datos Exportados    │  .npy, .csv, Blender
│  Listos para análisis   │  Trayectorias + ángulos
└─────────────────────────┘
```

## Parámetros de Marcha Calculables

### Parámetros Espaciotemporales
| Parámetro | Cómo calcularlo con FreeMoCap |
|-----------|-------------------------------|
| Velocidad de marcha | Desplazamiento horizontal del COM / tiempo |
| Cadencia | Frecuencia de ciclos de marcha (heel strikes) |
| Longitud de paso | Distancia entre heel strikes consecutivos (mismo pie) |
| Longitud de zancada | Distancia entre heel strikes alternados |
| Ancho de paso | Distancia lateral entre pies durante soporte doble |
| Tiempo de soporte simple | Tiempo con un solo pie en el suelo |
| Tiempo de soporte doble | Tiempo con ambos pies en el suelo |
| Simetría | Comparación lado izq vs derecho |

### Cinemática Articular
| Articulación | Landmarks usados | Plano principal |
|--------------|-----------------|-----------------|
| Cadera (flexión/extensión) | shoulder-hip-knee | Sagital |
| Rodilla (flexión/extensión) | hip-knee-ankle | Sagital |
| Tobillo (dorsi/plantar) | knee-ankle-foot_index | Sagital |
| Pelvis (inclinación) | left_hip - right_hip | Frontal/Sagital |

### Detección de Eventos de Marcha
```python
# Heel Strike: mínimo local de la altura del talón
# Toe-Off: cuando foot_index se despega del plano del suelo

def detect_heel_strikes(heel_height, threshold_velocity=-0.1):
    """
    Detecta heel strikes como los momentos donde:
    1. La altura del talón alcanza un mínimo local
    2. La velocidad vertical pasa de negativa a ~0
    """
    velocity = np.diff(heel_height)
    
    # Busca cruces por cero de la velocidad (descendente → estacionario)
    heel_strikes = []
    for i in range(1, len(velocity)):
        if velocity[i-1] < threshold_velocity and velocity[i] >= 0:
            heel_strikes.append(i)
    
    return np.array(heel_strikes)

def detect_toe_offs(foot_index_height, threshold=10):  # mm
    """
    Detecta toe-off como el momento donde foot_index
    se eleva por encima del umbral del suelo
    """
    ground_level = np.percentile(foot_index_height, 5)
    above_ground = foot_index_height > (ground_level + threshold)
    
    toe_offs = []
    for i in range(1, len(above_ground)):
        if not above_ground[i-1] and above_ground[i]:
            toe_offs.append(i)
    
    return np.array(toe_offs)
```

## Comparación con Sistemas Clínicos

| Característica | FreeMoCap | Vicon/OptiTrack | Sensor IMU |
|---------------|-----------|-----------------|------------|
| Marcadores | Sin marcadores | Con marcadores | Sin marcadores |
| Costo | Gratuito | $50k-$200k | $500-$5k |
| Precisión | ±10-20mm | ±0.5-1mm | ±5-15° |
| Setup | Cámaras web | Cámaras IR | Sensores body |
| Portabilidad | Alta | Baja (laboratorio) | Alta |
| Puntos tracked | 33 body | 30-50+ | 15-17 |
| Frame rate | 30-120 fps | 100-300 fps | 100-200 Hz |

## Limitaciones a Considerar

1. **Precisión**: ±10-20mm vs <1mm de sistemas clínicos gold-standard
2. **Oclusiones**: Si el cuerpo se oculta en alguna vista, la detección falla
3. **Ropa**: Ropa holgada puede afectar la detección de landmarks
4. **Iluminación**: Sensible a condiciones de luz (MediaPipe)
5. **Velocidad**: A 30fps pueden perderse eventos rápidos del ciclo de marcha
6. **Calibración**: Requiere buena calibración multi-cámara para precisión 3D

## Aplicación con Cámara Única (Relevante para App Móvil)

FreeMoCap soporta captura con 1 sola cámara:
- No hay triangulación 3D real
- Se obtienen coordenadas 2D (píxeles) o proyectadas a un plano
- Suficiente para:
  - Ángulos en plano sagital (rodilla, cadera, tobillo)
  - Cadencia y timing de eventos
  - Análisis cualitativo de la marcha
  - Screening inicial

### Para tu app GaitTest:
- Con una sola cámara de celular → análisis 2D sagital
- Los landmarks de MediaPipe son el estándar que usa FreeMoCap
- El filtrado Butterworth es esencial para datos suaves
- Los mismos índices de landmarks aplican
