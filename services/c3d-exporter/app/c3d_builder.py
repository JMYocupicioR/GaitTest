from __future__ import annotations

import os
import tempfile
from pathlib import Path

import ezc3d
import numpy as np

from .models import C3DExportRequest


DEFAULT_MARKER_NAMES = [
    "NOSE",
    "LEYEI",
    "LEYE",
    "LEYEO",
    "REYEI",
    "REYE",
    "REYEO",
    "LEAR",
    "REAR",
    "LMOUT",
    "RMOUT",
    "LSHO",
    "RSHO",
    "LELB",
    "RELB",
    "LWRA",
    "RWRA",
    "LPINK",
    "RPINK",
    "LINDX",
    "RINDX",
    "LTHMB",
    "RTHMB",
    "LHJC",
    "RHJC",
    "LKNE",
    "RKNE",
    "LANK",
    "RANK",
    "LHEE",
    "RHEE",
    "LTOE",
    "RTOE",
]


def _to_points_array(request: C3DExportRequest) -> np.ndarray:
    frame_count = len(request.frames)
    marker_count = len(request.frames[0]) if frame_count else 0
    points = np.zeros((4, marker_count, frame_count), dtype=np.float32)

    # C3D típico en mm (Z-Up). Alinear escala con TRC usando ancho de suelo calibrado.
    safe_ground_width_m = request.ground_width_meters if request.ground_width_meters > 0 else 1.8
    scale_mm = safe_ground_width_m * 1000.0
    for frame_idx, frame in enumerate(request.frames):
        for marker_idx, landmark in enumerate(frame):
            points[0, marker_idx, frame_idx] = landmark.x * scale_mm
            points[1, marker_idx, frame_idx] = landmark.y * scale_mm
            points[2, marker_idx, frame_idx] = landmark.z * scale_mm
            points[3, marker_idx, frame_idx] = 0.0
    return points


def build_c3d_bytes(request: C3DExportRequest) -> tuple[bytes, str]:
    if not request.frames:
        raise ValueError("No frames received for C3D export.")

    marker_count = len(request.frames[0])
    marker_names = request.marker_names or DEFAULT_MARKER_NAMES[:marker_count]
    if len(marker_names) < marker_count:
        marker_names = marker_names + [f"MKR_{i+1}" for i in range(len(marker_names), marker_count)]

    c3d_obj = ezc3d.c3d()
    c3d_obj["parameters"]["POINT"]["RATE"]["value"] = [float(request.frame_rate_hz)]
    c3d_obj["parameters"]["POINT"]["USED"]["value"] = [marker_count]
    c3d_obj["parameters"]["POINT"]["LABELS"]["value"] = marker_names
    c3d_obj["parameters"]["POINT"]["UNITS"]["value"] = ["mm"]
    c3d_obj["parameters"]["POINT"]["SCALE"]["value"] = [-1.0]
    c3d_obj["parameters"]["ANALOG"]["USED"]["value"] = [0]
    c3d_obj["data"]["points"] = _to_points_array(request)

    file_name = f"{request.session_id}.c3d"
    with tempfile.NamedTemporaryFile(suffix=".c3d", delete=False) as handle:
        temp_path = Path(handle.name)
    try:
        c3d_obj.write(str(temp_path))
        data = temp_path.read_bytes()
    finally:
        if temp_path.exists():
            os.unlink(temp_path)

    return data, file_name
