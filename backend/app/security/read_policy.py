"""Field-level read rights (RFP FUNC A.1), beside the write policy in field_policy.py.

Some fields are the bank's confidential terms with a borrower: limits, balances, rates, covenant ratios and
the borrower's own financials. A role without read rights on a field gets ``null`` in its place, in every
JSON response the API sends (REST and GraphQL alike), and the header ``X-Fields-Withheld`` names what was
withheld. Applying it to responses, rather than endpoint by endpoint, means a new endpoint cannot leak a
field by forgetting to filter it. File exports are open only to administrators and auditors, who read
everything.

The policy is by field name, wherever the field appears in a response.
"""

import json
from typing import Any, Dict, FrozenSet, Iterable, Set, Tuple

from backend.app.security.ldap_provider import UserRole

STAFF: FrozenSet[str] = frozenset(r.value for r in (UserRole.ADMIN, UserRole.MAKER, UserRole.APPROVER, UserRole.AUDITOR))

_CONFIDENTIAL = (
    # Facility terms and balances
    "sanctioned_amount", "disbursed_amount", "outstanding_principal", "outstanding_interest", "overdue_principal",
    "overdue_interest", "interest_rate_pct", "current_rate_pct", "current_rate_percent", "total_sanctioned_amount",
    "sanctioned_amount_npr", "disbursed_amount_npr", "outstanding_principal_npr",
    # Projection
    "opening_outstanding", "closing_outstanding", "total_disbursement", "total_repayment",
    "projected_disbursement", "projected_repayment", "projected_outstanding",
    # Covenant ratios and the figures behind them
    "dscr", "ltv", "icr", "revenue_npr", "operating_expenses_npr", "royalty_npr", "tax_paid_npr",
    "depreciation_npr", "security_value_npr", "debt_service_npr", "interest_npr",
    # Budget against cost
    "budgeted_amount", "actual_amount", "variance_amount", "variance_pct",
)

# Responses whose keys name fields without carrying their values (the translations of screen labels)
EXEMPT_PATHS = ("/api/v1/i18n/",)

# field -> roles that may read it
READ_POLICY: Dict[str, FrozenSet[str]] = {name: STAFF for name in _CONFIDENTIAL}


def withheld_for(roles: Iterable[Any]) -> FrozenSet[str]:
    """The fields these roles may not read."""
    values = {getattr(r, "value", r) for r in roles}
    return frozenset(field for field, allowed in READ_POLICY.items() if not values & allowed)


def redact(data: Any, hidden: FrozenSet[str]) -> Tuple[Any, Set[str]]:
    """``data`` with every hidden field set to null, at any depth, and the names that were present."""
    found: Set[str] = set()

    def walk(value: Any) -> Any:
        if isinstance(value, dict):
            out = {}
            for key, item in value.items():
                if key in hidden:
                    if item is not None:
                        found.add(key)
                    out[key] = None
                else:
                    out[key] = walk(item)
            return out
        if isinstance(value, list):
            return [walk(item) for item in value]
        return value

    return walk(data), found


def redact_body(body: bytes, hidden: FrozenSet[str]) -> Tuple[bytes, Set[str]]:
    try:
        data = json.loads(body)
    except ValueError:
        return body, set()
    redacted, found = redact(data, hidden)
    return (json.dumps(redacted, separators=(",", ":")).encode() if found else body), found
