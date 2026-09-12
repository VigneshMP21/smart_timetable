"""
Purpose: Supabase JWT Authentication Middleware
Author: Smart Timetable Backend Team
Module Description: Starlette middleware that inspects every incoming request.
If an Authorization: Bearer <token> header is present, it validates the
Supabase Auth access token and attaches the authenticated user to
request.state.

Public endpoints (e.g. /health, /, /docs) remain accessible without a token.
Endpoints that require authentication must additionally use the
get_current_user dependency, which reads the bearer token again from the
request.

Why both middleware and a dependency?
  - Middleware validates the token exactly once per request and enriches
    request.state for any endpoint.
  - The dependency enforces protection on the endpoints that need it, keeping
    public endpoints open by default.
"""

from typing import Any, Dict, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.security import (
    AuthError,
    decode_access_token,
    get_token_from_request,
    token_payload_to_user,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Validates backend-issued JWTs on incoming requests and attaches the user.

    Public paths listed in PUBLIC_PATHS bypass validation entirely. For all
    other paths the middleware attempts to validate the token when present;
    invalid tokens receive a 401, and missing tokens simply leave
    request.state.user as None.
    """

    # Endpoints that never require a token.
    # Auth is handled by Supabase Auth on the frontend; the backend only
    # exposes authenticated profile endpoints under /auth.
    PUBLIC_PATHS = {
        "/",
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/auth/public-example",
    }

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """
        Middleware entrypoint.

        Args:
            request (Request): The incoming request.
            call_next (Any): The next handler in the stack.

        Returns:
            Response: The response, possibly after rejecting an invalid token.
        """
        request.state.user = None
        path = request.url.path

        if path in self.PUBLIC_PATHS:
            return await call_next(request)

        token: Optional[str] = get_token_from_request(request)
        if token:
            try:
                payload = decode_access_token(token)
                user: Dict[str, Any] = token_payload_to_user(payload)
                if not user.get("id"):
                    raise AuthError("Token is missing the subject claim.")
                request.state.user = user
            except AuthError as exc:
                logger.warning("Auth middleware rejected token on %s: %s", path, exc.message)
                return JSONResponse(
                    status_code=401,
                    content={"detail": exc.message},
                    headers={"WWW-Authenticate": "Bearer"},
                )

        response = await call_next(request)
        return response
