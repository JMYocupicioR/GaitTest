from __future__ import annotations

from io import BytesIO

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse

from .auth import validate_supabase_jwt
from .c3d_builder import build_c3d_bytes
from .models import C3DExportRequest

app = FastAPI(title="GaitTest C3D Export Service", version="0.1.0")


def require_token(authorization: str | None = Header(default=None, alias="Authorization")) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token is required.",
        )
    token = authorization.replace("Bearer ", "", 1).strip()
    return validate_supabase_jwt(token)


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/export/c3d")
def export_c3d(
    payload: C3DExportRequest,
    _: dict = Depends(require_token),
) -> StreamingResponse:
    file_bytes, file_name = build_c3d_bytes(payload)
    stream = BytesIO(file_bytes)
    response = StreamingResponse(stream, media_type="application/octet-stream")
    response.headers["Content-Disposition"] = f'attachment; filename="{file_name}"'
    response.headers["X-File-Name"] = file_name
    response.headers["X-Bytes-Written"] = str(len(file_bytes))
    return response
