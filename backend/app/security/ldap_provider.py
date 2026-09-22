"""LDAP/Active Directory authentication provider for Phase 3.

Handles user authentication via AD domain with role mapping.
Fallback to local dev auth when AD unavailable.
"""

import logging
from typing import Optional, List, Dict, Any
from enum import Enum
from ldap3 import Server, Connection, ALL, NTLM

logger = logging.getLogger(__name__)


class UserRole(str, Enum):
    """User roles mapped from AD groups."""
    ADMIN = "admin"
    MAKER = "maker"
    APPROVER = "approver"
    AUDITOR = "auditor"
    GUEST = "guest"


class ADUser:
    """Authenticated AD user with roles."""

    def __init__(
        self,
        username: str,
        email: str,
        full_name: str,
        roles: List[UserRole],
        ad_distinguished_name: Optional[str] = None,
    ):
        self.username = username
        self.email = email
        self.full_name = full_name
        self.roles = roles
        self.ad_distinguished_name = ad_distinguished_name
        self.is_authenticated = True

    def has_role(self, role: UserRole) -> bool:
        """Check if user has a specific role."""
        return role in self.roles or UserRole.ADMIN in self.roles  # Admins bypass checks

    def has_any_role(self, roles: List[UserRole]) -> bool:
        """Check if user has any of the specified roles."""
        return any(self.has_role(r) for r in roles)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dict for JWT payload."""
        return {
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "roles": [r.value for r in self.roles],
            "is_authenticated": self.is_authenticated,
        }


class LDAPAuthProvider:
    """Authenticate users via Active Directory."""

    # AD group name to role mapping
    AD_GROUP_ROLE_MAP = {
        "SBL_HPMS_ADMIN": UserRole.ADMIN,
        "SBL_HPMS_MAKER": UserRole.MAKER,
        "SBL_HPMS_APPROVER": UserRole.APPROVER,
        "SBL_HPMS_AUDITOR": UserRole.AUDITOR,
    }

    def __init__(
        self,
        ad_server: str,
        ad_domain: str,
        ad_base_dn: str,
        service_account_username: Optional[str] = None,
        service_account_password: Optional[str] = None,
    ):
        """Initialize LDAP provider.

        Args:
            ad_server: AD server hostname (e.g., "ldap.sbl.local")
            ad_domain: AD domain (e.g., "sbl.local")
            ad_base_dn: Base DN for searches (e.g., "dc=sbl,dc=local")
            service_account_username: Service account for queries (optional)
            service_account_password: Service account password (optional)
        """
        self.ad_server = ad_server
        self.ad_domain = ad_domain
        self.ad_base_dn = ad_base_dn
        self.service_account_username = service_account_username
        self.service_account_password = service_account_password

    async def authenticate(
        self,
        username: str,
        password: str,
    ) -> Optional[ADUser]:
        """Authenticate user via AD and fetch roles.

        Args:
            username: Active Directory username (without domain)
            password: User password

        Returns:
            ADUser if authentication succeeds, None otherwise
        """

        try:
            # Connect to AD server
            server = Server(self.ad_server, get_info=ALL)

            # Try NTLM authentication first (Windows native)
            principal = f"{self.ad_domain}\\{username}"
            conn = Connection(
                server,
                user=principal,
                password=password,
                authentication=NTLM,
                raise_exceptions=True,
            )

            if not conn.bind():
                logger.warning(f"NTLM bind failed for {username}")
                # Fallback to simple bind
                user_dn = f"cn={username},{self.ad_base_dn}"
                conn = Connection(
                    server,
                    user=user_dn,
                    password=password,
                    raise_exceptions=True,
                )
                if not conn.bind():
                    logger.warning(f"Simple bind failed for {username}")
                    return None

            # User authenticated - fetch details and roles
            user_info = await self._fetch_user_info(conn, username)
            if not user_info:
                logger.warning(f"Could not fetch user info for {username}")
                return None

            roles = await self._fetch_user_roles(conn, username)
            if not roles:
                roles = [UserRole.GUEST]  # Default to guest if no roles

            conn.unbind()

            ad_user = ADUser(
                username=username,
                email=user_info.get("email", f"{username}@{self.ad_domain}"),
                full_name=user_info.get("full_name", username),
                roles=roles,
                ad_distinguished_name=user_info.get("distinguished_name"),
            )

            logger.info(f"User {username} authenticated with roles: {[r.value for r in roles]}")
            return ad_user

        except Exception as e:
            logger.error(f"AD authentication failed for {username}: {e}")
            return None

    async def _fetch_user_info(
        self,
        conn: Connection,
        username: str,
    ) -> Optional[Dict[str, str]]:
        """Fetch user details from AD.

        Args:
            conn: Active LDAP connection
            username: Username to lookup

        Returns:
            Dict with email, full_name, distinguished_name
        """

        try:
            search_filter = f"(sAMAccountName={username})"
            conn.search(
                search_base=self.ad_base_dn,
                search_filter=search_filter,
                attributes=["mail", "displayName", "cn", "distinguishedName"],
            )

            if conn.entries:
                entry = conn.entries[0]
                return {
                    "email": entry.mail.value if entry.mail else f"{username}@{self.ad_domain}",
                    "full_name": entry.displayName.value if entry.displayName else username,
                    "distinguished_name": entry.distinguishedName.value,
                }

            return None

        except Exception as e:
            logger.error(f"Failed to fetch user info for {username}: {e}")
            return None

    async def _fetch_user_roles(
        self,
        conn: Connection,
        username: str,
    ) -> List[UserRole]:
        """Fetch user roles from AD group membership.

        Args:
            conn: Active LDAP connection
            username: Username to lookup

        Returns:
            List of UserRole enums
        """

        try:
            roles = []

            # Search for user's group memberships
            search_filter = f"(member=cn={username},{self.ad_base_dn})"
            conn.search(
                search_base=self.ad_base_dn,
                search_filter=search_filter,
                attributes=["cn"],
            )

            for entry in conn.entries:
                group_cn = entry.cn.value if entry.cn else None
                if group_cn and group_cn in self.AD_GROUP_ROLE_MAP:
                    roles.append(self.AD_GROUP_ROLE_MAP[group_cn])

            return roles

        except Exception as e:
            logger.error(f"Failed to fetch user roles for {username}: {e}")
            return []


class LocalDevAuthProvider:
    """Local authentication for development (no AD required).

    Supports test users with hardcoded credentials.
    """

    # Hardcoded test users (dev only)
    TEST_USERS = {
        "admin": {
            "password": "admin123",
            "email": "admin@sbl.local",
            "full_name": "Admin User",
            "roles": [UserRole.ADMIN],
        },
        "maker": {
            "password": "maker123",
            "email": "maker@sbl.local",
            "full_name": "Maker User",
            "roles": [UserRole.MAKER],
        },
        "approver": {
            "password": "approver123",
            "email": "approver@sbl.local",
            "full_name": "Approver User",
            "roles": [UserRole.APPROVER],
        },
        "auditor": {
            "password": "auditor123",
            "email": "auditor@sbl.local",
            "full_name": "Auditor User",
            "roles": [UserRole.AUDITOR],
        },
        "guest": {
            "password": "guest123",
            "email": "guest@sbl.local",
            "full_name": "Guest User",
            "roles": [UserRole.GUEST],
        },
    }

    async def authenticate(
        self,
        username: str,
        password: str,
    ) -> Optional[ADUser]:
        """Authenticate against hardcoded test users.

        Args:
            username: Test username
            password: Test password

        Returns:
            ADUser if credentials match
        """

        if username not in self.TEST_USERS:
            logger.warning(f"Unknown test user: {username}")
            return None

        user_config = self.TEST_USERS[username]
        if user_config["password"] != password:
            logger.warning(f"Invalid password for test user: {username}")
            return None

        return ADUser(
            username=username,
            email=user_config["email"],
            full_name=user_config["full_name"],
            roles=user_config["roles"],
        )
