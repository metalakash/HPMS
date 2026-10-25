"""Directory groups to HPMS roles come from configuration (AD_GROUP_ROLE_MAP), not from the code (no directory needed)."""

from types import SimpleNamespace

import pytest

from backend.app.security.auth_selection import build_auth_provider
from backend.app.security.ldap_provider import LDAPAuthProvider, UserRole, parse_group_role_map


def provider(mapping=None):
    return LDAPAuthProvider("ldap.example.org", "example.org", "dc=example,dc=org", group_role_map=mapping)


def test_a_bank_names_its_own_groups_and_several_can_give_one_role():
    p = provider("HPMS-Credit-Admins=admin, HPMS-RM-Kathmandu=maker, HPMS-RM-Pokhara=maker, HPMS-Checkers=approver")
    assert p.roles_for_groups(["HPMS-RM-Pokhara"]) == [UserRole.MAKER]
    assert p.roles_for_groups(["hpms-credit-admins"]) == [UserRole.ADMIN]  # AD compares group names without case
    assert p.roles_for_groups(["Domain Users", "VPN"]) == []  # groups outside the map give nothing


def test_a_user_in_several_groups_gets_each_role_once_most_privileged_first():
    p = provider("A=maker,B=admin,C=maker,D=auditor")
    assert p.roles_for_groups(["A", "C", "D", "B"]) == [UserRole.ADMIN, UserRole.MAKER, UserRole.AUDITOR]


def test_the_default_keeps_the_previous_group_names():
    assert provider().roles_for_groups(["SBL_HPMS_APPROVER"]) == [UserRole.APPROVER]


@pytest.mark.parametrize("text,problem", [
    ("", "is empty"),
    ("HPMS-Admins", "is not group=role"),
    ("HPMS-Admins=superuser", "unknown role"),
    ("=admin", "no group name"),
    ("X=admin,x=maker", "mapped to two roles"),
])
def test_a_mistyped_mapping_is_refused(text, problem):
    with pytest.raises(ValueError, match=problem):
        parse_group_role_map(text)


def test_the_setting_reaches_the_provider_and_a_bad_one_stops_startup():
    settings = SimpleNamespace(USE_LDAP=True, AD_SERVER="ldap.example.org", AD_DOMAIN="example.org",
                               AD_BASE_DN="dc=example,dc=org", AD_SERVICE_ACCOUNT_USERNAME="",
                               AD_SERVICE_ACCOUNT_PASSWORD="", AD_GROUP_ROLE_MAP="Bank-HPMS-Audit=auditor",
                               ALLOW_DEV_AUTH=None, DEBUG=False)
    assert build_auth_provider(settings).roles_for_groups(["Bank-HPMS-Audit"]) == [UserRole.AUDITOR]
    settings.AD_GROUP_ROLE_MAP = "Bank-HPMS-Audit=reader"
    with pytest.raises(ValueError, match="unknown role"):
        build_auth_provider(settings)


class _FakeConnection:
    """Stands in for ldap3: the bind succeeds and the user belongs to the given groups."""

    def __init__(self, groups):
        self.entries = [SimpleNamespace(cn=SimpleNamespace(value=g)) for g in groups]

    def bind(self):
        return True

    def search(self, **kwargs):
        return True

    def unbind(self):
        return True


@pytest.mark.parametrize("groups,expected", [
    (["Domain Users", "VPN"], None),            # a valid directory account outside every HPMS group
    (["Domain Users", "Bank-HPMS-Audit"], ["auditor"]),
])
async def test_only_users_in_a_mapped_group_may_sign_in(monkeypatch, groups, expected):
    from backend.app.security import ldap_provider

    p = provider("Bank-HPMS-Audit=auditor")
    monkeypatch.setattr(ldap_provider, "Server", lambda *a, **k: object())
    monkeypatch.setattr(ldap_provider, "Connection", lambda *a, **k: _FakeConnection(groups))

    async def info(conn, username):
        return {"email": f"{username}@example.org", "full_name": username}

    monkeypatch.setattr(p, "_fetch_user_info", info)
    user = await p.authenticate("sita", "secret")
    assert (None if user is None else [r.value for r in user.roles]) == expected
