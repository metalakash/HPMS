"""Who approves each type of change request, and in how many steps (RFP FUNC A.3, TECH D.9).

A rule belongs to a change type and is kept as that type's active workflow definition:

    {"steps": ["submitted", "recommended", "approved"],   # or ["submitted", "approved"] for one check
     "recommend_roles": ["approver", "admin"],             # who may give the recommendation
     "approve_roles": ["approver", "admin"]}               # who may give the final approval

A request is bound to the definition in force when it was raised, so changing a rule never changes the
requests already in the queue. Whatever the rule says, nobody checks their own change and the two
checks of a two-step rule come from different people (enforced by the mutation service).
"""

import json
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.governance import WorkflowDefinition

CHECKER_ROLES = ("approver", "admin")
TWO_STEP = ["submitted", "recommended", "approved"]
ONE_STEP = ["submitted", "approved"]

# Change types whose final approval is reserved for administrators unless an admin changes the rule
ADMIN_FINAL = {"COVENANT_TERMS", "SETTING", "APPROVAL_RULE", "BANK_IMPORT"}

# The change types a rule can be set for, with what they are called on screen
CHANGE_TYPES = {
    "PROJECT": "Project details",
    "LOAN": "Loan terms",
    "FINANCIAL_PERIOD": "Quarterly covenant figures",
    "COVENANT_TERMS": "Sanction terms",
    "BUDGET_LINE": "Budget and cost lines",
    "LOAN_PROJECTION": "Loan projection",
    "SETTING": "Application settings",
    "APPROVAL_RULE": "Approval rules",
    "EXCHANGE_RATE": "Exchange rates",
    "BANK_IMPORT": "Bank workbook import",
}


def default_rule(entity_type: str) -> Dict[str, Any]:
    final = ["admin"] if entity_type.upper() in ADMIN_FINAL else list(CHECKER_ROLES)
    return {"steps": list(TWO_STEP), "recommend_roles": list(CHECKER_ROLES), "approve_roles": final}


def parse(raw: Optional[str], entity_type: str) -> Dict[str, Any]:
    """A stored definition as a rule. Definitions written before rules existed get the default."""
    try:
        data = json.loads(raw or "{}")
    except ValueError:
        data = {}
    rule = default_rule(entity_type)
    if data.get("steps") in (TWO_STEP, ONE_STEP):
        rule["steps"] = data["steps"]
    for key in ("recommend_roles", "approve_roles"):
        roles = [r for r in data.get(key, []) if r in CHECKER_ROLES]
        if roles:
            rule[key] = roles
    return rule


def check(rule: Dict[str, Any]) -> Dict[str, Any]:
    """A proposed rule, refused when it does not make sense."""
    unknown = set(rule) - {"steps", "recommend_roles", "approve_roles"}
    if unknown:
        raise ValueError(f"{', '.join(sorted(unknown))} is not part of an approval rule")
    steps = rule.get("steps")
    if steps not in (TWO_STEP, ONE_STEP):
        raise ValueError("steps: either a recommendation then an approval, or a single approval")
    cleaned: Dict[str, Any] = {"steps": steps}
    for key in ("approve_roles",) + (("recommend_roles",) if steps == TWO_STEP else ()):
        roles = rule.get(key) or []
        if not roles or any(r not in CHECKER_ROLES for r in roles):
            raise ValueError(f"{key}: choose from {', '.join(CHECKER_ROLES)}")
        cleaned[key] = sorted(set(roles))
    if steps == ONE_STEP:
        cleaned["recommend_roles"] = []
    return cleaned


async def active_definition(db: AsyncSession, entity_type: str) -> Optional[WorkflowDefinition]:
    return (await db.execute(
        select(WorkflowDefinition)
        .where(WorkflowDefinition.entity_type == entity_type.upper(), WorkflowDefinition.is_active.is_(True))
        .order_by(WorkflowDefinition.version.desc()).limit(1))).scalar()


async def rule_for_request(db: AsyncSession, workflow_definition_id: Any, entity_type: str) -> Dict[str, Any]:
    definition = None
    if workflow_definition_id is not None:
        definition = await db.get(WorkflowDefinition, UUID(str(workflow_definition_id)))
    return parse(definition.workflow_steps if definition else None, entity_type)


async def rules_for_requests(db: AsyncSession, approvals) -> Dict[str, Dict[str, Any]]:
    """Rule per request id, loading each definition once."""
    ids = {getattr(a, "workflow_definition_id", None) for a in approvals} - {None}
    definitions = {}
    if ids:
        rows = (await db.execute(select(WorkflowDefinition).where(WorkflowDefinition.id.in_(ids)))).scalars()
        definitions = {d.id: d for d in rows}
    return {str(a.id): parse(getattr(definitions.get(getattr(a, "workflow_definition_id", None)), "workflow_steps", None),
                             a.entity_type)
            for a in approvals}


async def current_rules(db: AsyncSession) -> List[Dict[str, Any]]:
    rules = []
    for entity_type, label in CHANGE_TYPES.items():
        definition = await active_definition(db, entity_type)
        rules.append({"entity_type": entity_type, "label": label,
                      "version": definition.version if definition else 0,
                      **parse(definition.workflow_steps if definition else None, entity_type)})
    return rules
