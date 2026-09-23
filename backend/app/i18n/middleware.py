"""Middleware for language detection and response transformation."""

import logging
import json
from typing import Optional, Callable, Any
from uuid import UUID

from fastapi import Request, Response
from starlette.types import ASGIApp, Receive, Scope, Send

from .service import get_i18n_service, DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)


class LanguageDetectionMiddleware:
    """Middleware to detect language from headers and inject into request state."""

    def __init__(self, app: ASGIApp):
        self.app = app
        self.i18n = get_i18n_service()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Extract Accept-Language header
        headers = dict(scope.get("headers", []))
        accept_language = headers.get(b"accept-language", b"").decode("utf-8")

        # Detect language
        language = self.i18n.detect_language(accept_language=accept_language)

        # Store in request state for route handlers
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["language"] = language
        scope["state"]["accept_language"] = accept_language

        logger.debug(f"Detected language: {language} from header: {accept_language}")

        # Continue to app
        await self.app(scope, receive, send)


class LanguageContext:
    """Context manager for setting language during request."""

    def __init__(self, language: str = DEFAULT_LANGUAGE):
        self.language = language
        self.i18n = get_i18n_service()

    def __enter__(self):
        return self.language

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def translate(self, key: str) -> str:
        """Translate a key using context language."""
        return self.i18n.translate(key, self.language)

    def get_error_message(self, error_key: str) -> str:
        """Get error message in context language."""
        return self.i18n.get_error_message(error_key, self.language)

    def translate_dict(self, data: dict, translate_keys: bool = False) -> dict:
        """Translate dictionary in context language."""
        return self.i18n.translate_dict(data, self.language, translate_keys)


def get_language_from_request(request: Request) -> str:
    """Extract language from request state.

    Args:
        request: FastAPI Request object

    Returns:
        Language code (en or ne)
    """
    return request.state.get("language", DEFAULT_LANGUAGE)


async def get_language_dependency(request: Request) -> str:
    """Dependency for injecting language into route handlers.

    Args:
        request: FastAPI Request object

    Returns:
        Language code (en or ne)
    """
    return get_language_from_request(request)
