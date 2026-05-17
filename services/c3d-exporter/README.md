# GaitTest C3D Exporter Service

Microservicio Python (FastAPI + ezc3d) para generar archivos `.c3d` binarios desde los landmarks de GaitTest.

## Endpoints

- `GET /health`
- `POST /export/c3d`
  - Auth: `Authorization: Bearer <supabase_jwt>`
  - Body:
    - `sessionId`
    - `frameRateHz`
    - `frames` (`num_frames x num_markers x {x,y,z,visibility}`)
    - `markerNames` opcional
    - `targetSystem` opcional

## Local

```bash
cd services/c3d-exporter
pip install -e .
uvicorn app.main:app --reload --port 8080
```

## Docker

```bash
docker build -t gaittest-c3d-exporter .
docker run -p 8080:8080 gaittest-c3d-exporter
```
