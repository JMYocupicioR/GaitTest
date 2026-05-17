from pydantic import BaseModel, Field


class Landmark3D(BaseModel):
    x: float
    y: float
    z: float
    visibility: float = 1.0


class C3DExportRequest(BaseModel):
    session_id: str = Field(alias="sessionId")
    frame_rate_hz: float = Field(alias="frameRateHz", default=30.0)
    marker_names: list[str] | None = Field(alias="markerNames", default=None)
    frames: list[list[Landmark3D]]
    target_system: str = Field(alias="targetSystem", default="Visual3D")
    coordinate_mode: str = Field(alias="coordinateMode", default="zup_mm")
    ground_width_meters: float = Field(alias="groundWidthMeters", default=1.8)


class C3DExportResponse(BaseModel):
    file_name: str = Field(alias="fileName")
    bytes_written: int = Field(alias="bytesWritten")
