"""Bank-wide configuration as change requests: application settings (FUNC A.5) and approval rules (A.3, D.9).

Both are proposed by an administrator and, by default, need another administrator's final approval.

    SETTING        entity_id = the setting's name   {"value": "60"}
    APPROVAL_RULE  entity_id = the change type      {"steps": [...], "recommend_roles": [...], "approve_roles": [...]}
"""

import json
from typing import Any, Dict
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.governance import WorkflowDefinition
from backend.app.services import app_settings, approval_rules
from backend.app.services.change_kinds import ChangeKind, only_fields, register

ADMINS = frozenset({"admin"})


# ---------------------------------------------------------------- settings

def _setting_change(entity_id: Any, changes: Dict[str, Any]):
    only_fields(changes, ["value"], "SETTING")
    name = str(entity_id)
    if "value" not in changes:
        raise ValueError("value is required")
    return name, app_settings.parse(name, changes["value"])


async def prepare_setting(db: AsyncSession, entity_id: Any, changes: Dict[str, Any]) -> Dict[str, Any]:
    name, number = _setting_change(entity_id, changes)
    current = await app_settings.values(db)
    if current[name] == number:
        raise ValueError(f"{app_settings.SETTINGS[name].label} is already {number}")
    app_settings.check_consistent({**current, name: number})
    return {"value": str(current[name])}


async def apply_setting(db: AsyncSession, entity_id: Any, changes: Dict[str, Any], approver: str):
    name, number = _setting_change(entity_id, changes)
    app_settings.check_consistent({**await app_settings.values(db), name: number})
    previous = await app_settings.save(db, name, number, approver)
    if name in app_settings.COVENANT_DEFAULTS:
        # Facilities without their own terms are tested against the defaults: re-test them now
        from backend.app.services.covenant_service import CovenantService
        await CovenantService.recalculate_all(db)
    return {"value": str(previous)}, {"value": str(number)}


register(ChangeKind(name="SETTING", project_scoped=False, prepare=prepare_setting, apply=apply_setting,
                    label="Setting", author_roles=ADMINS))


# ---------------------------------------------------------------- approval rules

def _rule_change(entity_id: Any, changes: Dict[str, Any]):
    entity_type = str(entity_id).upper()
    if entity_type not in approval_rules.CHANGE_TYPES:
        raise ValueError(f"No approval rule can be set for {entity_id!r}")
    return entity_type, approval_rules.check(changes)


async def prepare_rule(db: AsyncSession, entity_id: Any, changes: Dict[str, Any]) -> Dict[str, Any]:
    entity_type, rule = _rule_change(entity_id, changes)
    definition = await approval_rules.active_definition(db, entity_type)
    current = approval_rules.parse(definition.workflow_steps if definition else None, entity_type)
    if approval_rules.check(current) == rule:
        raise ValueError("This is already the rule")
    return current


async def apply_rule(db: AsyncSession, entity_id: Any, changes: Dict[str, Any], approver: str):
    entity_type, rule = _rule_change(entity_id, changes)
    definition = await approval_rules.active_definition(db, entity_type)
    before = approval_rules.parse(definition.workflow_steps if definition else None, entity_type)
    version = 1
    if definition is not None:
        definition.is_active, definition.updated_by = False, approver
        version = (definition.version or 1) + 1
    db.add(WorkflowDefinition(
        id=uuid4(), name=f"{entity_type.lower()}-v{version}", entity_type=entity_type, is_active=True,
        version=version, description=f"Set by {approver} through an approved change request",
        workflow_steps=json.dumps(rule), created_by=approver))
    await db.flush()
    return before, rule


register(ChangeKind(name="APPROVAL_RULE", project_scoped=False, prepare=prepare_rule, apply=apply_rule,
                    label="Approval rule for", author_roles=ADMINS))
