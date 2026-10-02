"""Choose the authentication provider, and refuse the built-in demo accounts outside development.

``LocalDevAuthProvider`` accepts hard-coded users (``admin`` / ``admin123`` ...) whose passwords are in the
source repository, so it must never be reachable on a deployed system by accident.

Rules, in order:
1. ``USE_LDAP=true``                      -> Active Directory; demo accounts are never available.
2. ``ALLOW_DEV_AUTH=true``                -> demo accounts, explicitly requested (logged as a warning).
3. ``ALLOW_DEV_AUTH=false``               -> no provider.
4. ``ALLOW_DEV_AUTH`` unset               -> demo accounts only while ``DEBUG=true`` (the local default).
"""

import logging
from typing import Optional, Union

from backend.app.security.ldap_provider import LDAPAuthProvider, LocalDevAuthProvider

logger = logging.getLogger(__name__)

AuthProvider = Union[LDAPAuthProvider, LocalDevAuthProvider]


def dev_auth_allowed(use_ldap: bool, allow_dev_auth: Optional[bool], debug: bool) -> bool:
    if use_ldap:
        return False
    if allow_dev_auth is not None:
        return allow_dev_auth
    return debug


def build_auth_provider(settings) -> Optional[AuthProvider]:
    """The provider to authenticate with, or None when no safe provider is configured."""
    if settings.USE_LDAP:
        return LDAPAuthProvider(
            ad_server=settings.AD_SERVER,
            ad_domain=settings.AD_DOMAIN,
            ad_base_dn=settings.AD_BASE_DN,
            service_account_username=settings.AD_SERVICE_ACCOUNT_USERNAME,
            service_account_password=settings.AD_SERVICE_ACCOUNT_PASSWORD,
        )
    if dev_auth_allowed(settings.USE_LDAP, settings.ALLOW_DEV_AUTH, settings.DEBUG):
        if not settings.DEBUG:
            logger.warning("Built-in demo accounts are ENABLED (ALLOW_DEV_AUTH=true) with DEBUG off. "
                           "Their passwords are public; do not use this with real data.")
        return LocalDevAuthProvider()
    logger.error("No authentication provider is configured: set USE_LDAP=true, or ALLOW_DEV_AUTH=true for a demo.")
    return None
