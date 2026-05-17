import os
from jose import jwt, JWTError
from fastapi import HTTPException, status


def validate_supabase_jwt(token: str) -> dict:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        # Entorno local sin auth estricta.
        return {"sub": "local-dev-user"}

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token for C3D export service.",
        ) from error
