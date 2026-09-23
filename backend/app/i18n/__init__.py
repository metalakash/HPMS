"""Internationalization (i18n) module for multi-language support."""

from .service import I18nService, get_i18n_service
from .translations import Translation

__all__ = ["I18nService", "get_i18n_service", "Translation"]
