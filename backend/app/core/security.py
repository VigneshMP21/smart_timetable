"""
Purpose: Supabase Auth Security Helpers
Author: Smart Timetable Backend Team
Module Description: Validates the Supabase Auth access tokens received on
incoming requests and exposes the FastAPI dependency used to protect endpoints.

The frontend signs the user in with the supabase-js client and sends the
resulting access token as "Authorization: Bearer <token>". Access tokens are
verified with the algorithm declared in the token header:

  - ES256 (ECDSA): the token's signing key is resolved from the project's
    JWKS endpoint ({SUPABASE_URL}/auth/v1/.well-known/jwks.json) by `kid`.
  - HS256: the token is verified locally with SUPABASE_JWT_SECRET.

No passwords are stored or verified here - Supabase Auth owns credential
management entirely.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWTError

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# HTTPBearer automatically extracts the "Authorization: Bearer <token>" header.
bearer_scheme = HTTPBearer(auto_error=False)

# Expected claims for a Supabase access token.
_SUPABASE_JWT_ALGORITHM = "HS256"
_SUPABASE_ES_ALGORITHM = "ES256"
_SUPABASE_AUDIENCES = {"authenticated"}

# Lazily-created JWKS client (fetches + caches the project signing keys).
_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    """
    Return the cached Supabase JWKS client, creating it on first use.

    The client fetches the project's public signing keys once and caches them,
    re-fetching automatically when a token references an unknown `kid`.

    Returns:
        PyJWKClient: The shared JWKS client for the configured project.
    """
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


class AuthError(Exception):
    """
    Internal exception raised when a token cannot be validated.

    Attributes:
        message (str): Human readable reason for the rejection.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


# ---------------------------------------------------------------------------
# Access token validation
# ---------------------------------------------------------------------------
def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a Supabase Auth access token.

    The verification algorithm follows the token header: ES256 tokens are
    checked against the project JWKS (by kid), HS256 tokens against the
    project JWT secret.

    Args:
        token (str): The raw JWT from the Authorization header.

    Returns:
        Dict[str, Any]: The decoded JWT claims (sub, email, role, etc.).

    Raises:
        AuthError: If the token is missing, expired, malformed, uses an
            unsupported algorithm, or the project credentials are absent.
    """
    if not settings.supabase_configured:
        raise AuthError(
            "Authentication is not configured. "
            "Please set SUPABASE_URL and SUPABASE_ANON_KEY in the backend .env file."
        )

    if not token:
        raise AuthError("Missing access token.")

    try:
        header_alg = jwt.get_unverified_header(token).get("alg")
    except PyJWTError as exc:
        logger.warning("Rejected malformed access token: %s", exc)
        raise AuthError("Invalid or expired access token.") from exc

    _jwt_options = {
        "verify_aud": False,
        "verify_exp": True,
        # The local clock may drift from Supabase's server clock, which makes
        # freshly-issued tokens look like they have a future `iat`. `iat`
        # validation is skipped; `exp` gets a small leeway to absorb skew.
        "verify_iat": False,
    }

    try:
        if header_alg == _SUPABASE_ES_ALGORITHM:
            signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
            payload: Dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=[_SUPABASE_ES_ALGORITHM],
                options=_jwt_options,
                leeway=30,
            )
        elif header_alg == _SUPABASE_JWT_ALGORITHM:
            if not settings.SUPABASE_JWT_SECRET:
                raise AuthError(
                    "SUPABASE_JWT_SECRET is not configured; "
                    "cannot verify HS256 access token."
                )
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=[_SUPABASE_JWT_ALGORITHM],
                options=_jwt_options,
                leeway=30,
            )
        else:
            logger.warning(
                "Rejected access token with unsupported algorithm: %s", header_alg
            )
            raise AuthError("Invalid or expired access token.")
    except PyJWTError as exc:
        logger.warning("Rejected access token: %s", exc)
        raise AuthError("Invalid or expired access token.") from exc
    except AuthError:
        raise
    except Exception as exc:  # e.g. JWKS fetch / network failure
        logger.warning("Failed to verify access token: %s", exc)
        raise AuthError("Invalid or expired access token.") from exc

    audience = payload.get("aud")
    if audience not in _SUPABASE_AUDIENCES:
        logger.warning("Rejected access token with unexpected audience: %s", audience)
        raise AuthError("Invalid or expired access token.")

    if not payload.get("sub"):
        raise AuthError("Token is missing the subject claim.")

    return payload


def token_payload_to_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize the decoded Supabase JWT claims into a compact user dictionary.

    Args:
        payload (Dict[str, Any]): Decoded JWT claims.

    Returns:
        Dict[str, Any]: A flat user representation used across the API.
    """
    metadata = payload.get("user_metadata") or {}
    return {
        "id": str(payload.get("sub")),
        "email": payload.get("email") or metadata.get("email"),
        "role": payload.get("role") or "user",
        "full_name": metadata.get("full_name") or "",
        "college_name": metadata.get("college_name") or "",
        "department": metadata.get("department") or "",
        "phone_number": metadata.get("phone_number") or "",
        "user_metadata": metadata,
    }


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """
    FastAPI dependency that resolves the authenticated user from the request.

    Used on protected endpoints. Raises HTTP 401 when the token is absent
    or invalid.

    Args:
        credentials (Optional[HTTPAuthorizationCredentials]): Extracted bearer token.

    Returns:
        Dict[str, Any]: The normalized authenticated user dictionary.

    Raises:
        HTTPException: 401 when the token cannot be validated.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please provide a valid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
        return token_payload_to_user(payload)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=exc.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_token_from_request(request: Request) -> Optional[str]:
    """
    Extract the raw bearer token from an incoming request (for middleware use).

    Args:
        request (Request): The incoming FastAPI request.

    Returns:
        Optional[str]: The token string or None if not present.
    """
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def token_expiry_timestamp(payload: Dict[str, Any]) -> Optional[int]:
    """
    Return the JWT expiry as a unix timestamp.

    Args:
        payload (Dict[str, Any]): Decoded JWT claims.

    Returns:
        Optional[int]: Expiry timestamp in seconds, or None if absent.
    """
    exp = payload.get("exp")
    if exp is None:
        return None
    if isinstance(exp, datetime):
        return int(exp.replace(tzinfo=timezone.utc).timestamp())
    return int(exp)


def is_valid_uuid(value: str) -> bool:
    """
    Check whether a string is a well-formed UUID (Supabase auth user id).

    Args:
        value (str): Candidate UUID string.

    Returns:
        bool: True when the string parses as a UUID.
    """
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False
