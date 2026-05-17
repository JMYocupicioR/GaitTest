import ezc3d
import numpy as np

from app.c3d_builder import build_c3d_bytes
from app.models import C3DExportRequest


def test_build_c3d_bytes_roundtrip():
    request = C3DExportRequest.model_validate(
        {
            "sessionId": "session-test",
            "frameRateHz": 30,
            "groundWidthMeters": 1.8,
            "frames": [
                [{"x": 0.1, "y": 0.2, "z": -0.1, "visibility": 0.99} for _ in range(33)],
                [{"x": 0.11, "y": 0.2, "z": -0.1, "visibility": 0.99} for _ in range(33)],
            ],
        }
    )
    data, filename = build_c3d_bytes(request)

    assert filename.endswith(".c3d")
    assert len(data) > 1024

    c3d = ezc3d.c3d(data)
    points = c3d["data"]["points"]
    assert isinstance(points, np.ndarray)
    assert points.shape[1] == 33
    assert np.isclose(points[0, 0, 0], 180.0)
