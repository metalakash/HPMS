"""Field-level write rights for maker-checker mutations (RFP A.1).

A change request names the fields it wants to alter. Some fields are owned by another system
(CBS balances, calculated covenant metrics, audit columns) and may never be proposed through the
API; others move money terms and may be proposed only by makers and admins (approvers are the
checkers and must not also author). Fields the policy does not mention are unrestricted, so new
entity types keep working until someone decides otherwise.
"""

from dataclasses import dataclass
from typing import Any, Dict, FrozenSet, Iterable, List, Mapping

from backend.app.security.ldap_provider import UserRole

NOBODY: FrozenSet[str] = frozenset()
AUTHORS: FrozenSet[str] = frozenset({UserRole.MAKER.value, UserRole.ADMIN.value})


@dataclass(frozen=True)
class FieldRule:
    write_roles: FrozenSet[str]  # roles that may propose a change; NOBODY = read-only through the API
    reason: str


_AUDIT_COLUMNS = {
    name: FieldRule(NOBODY, "audit/system column")
    for name in ("id", "created_at", "created_by", "updated_by", "state_hash", "prev_hash")
}

POLICY: Dict[str, Dict[str, FieldRule]] = {
    "LOAN": {
        **_AUDIT_COLUMNS,
        **{name: FieldRule(NOBODY, "owned by the core banking system; changes arrive through CBS sync")
           for name in ("finacle_account_id", "outstanding_principal", "outstanding_interest",
                        "overdue_principal", "overdue_interest")},
        **{name: FieldRule(NOBODY, "calculated by the covenant engine") for name in ("dscr", "ltv", "icr")},
        **{name: FieldRule(AUTHORS, "financial term: maker or admin only")
           for name in ("sanctioned_amount", "disbursed_amount", "interest_rate_pct", "maturity_ad", "maturity_bs")},
    },
    "PROJECT": {
        **_AUDIT_COLUMNS,
        **{name: FieldRule(AUTHORS, "project master data: maker or admin only")
           for name in ("project_code", "installed_capacity_mw", "pipeline_status", "project_stage")},
    },
}


def violations(entity_type: str, changes: Mapping[str, Any], roles: Iterable[Any]) -> List[str]:
    """Human-readable reasons the role set may not make these changes; empty when allowed."""
    rules = POLICY.get(entity_type.upper(), {})
    role_values = {getattr(r, "value", r) for r in roles}
    problems = []
    for field in changes:
        rule = rules.get(field)
        if rule is None:
            continue
        if not (role_values & rule.write_roles):
            who = "no one" if not rule.write_roles else "only " + "/".join(sorted(rule.write_roles))
            problems.append(f"{field} cannot be changed by this role ({rule.reason}; allowed: {who})")
    return problems


def check_write(entity_type: str, changes: Mapping[str, Any], roles: Iterable[Any]) -> None:
    """Raise PermissionError listing every field the caller may not change."""
    problems = violations(entity_type, changes, roles)
    if problems:
        raise PermissionError("; ".join(problems))
