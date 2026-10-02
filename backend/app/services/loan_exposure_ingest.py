"""Loan exposure ingestion shared by the upload endpoint and the scheduled sync (Phase 8.2 / 8.3).

Upserts ``loan_accounts`` (one per project + facility type) with their rate history, and records the batch in
the hash-chained audit log. The caller owns authentication and the HTTP layer; the scheduled sync calls this
directly instead of posting back to its own API.
"""

import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import LoanAccount, LoanAccountRateHistory
from backend.app.models.project import Project
from backend.app.schemas.loan import LoanExposureImportItem
from backend.app.services.audit_chain import append_audit_log

logger = logging.getLogger(__name__)


def coerce_items(raw: List[Any]) -> tuple[List[LoanExposureImportItem], List[str]]:
    """Validate raw dicts (from a bank API) into import items; invalid records become error strings."""
    items, errors = [], []
    for idx, record in enumerate(raw, 1):
        if isinstance(record, LoanExposureImportItem):
            items.append(record)
            continue
        try:
            # The schema is strict (right for typed API input); bank JSON carries dates and amounts as text/floats
            items.append(LoanExposureImportItem.model_validate(record, strict=False))
        except Exception as e:  # pydantic ValidationError, TypeError for non-dict records
            errors.append(f"Record {idx}: {str(e).splitlines()[0][:100]}")
    return items, errors


async def ingest_loan_exposures(
    db: AsyncSession,
    items: List[LoanExposureImportItem],
    sync_source: str,
    source_reference: Optional[str],
    actor: str,
    actor_role: Optional[str] = None,
    extra_errors: Optional[List[str]] = None,
    total_submitted: Optional[int] = None,
) -> Dict[str, Any]:
    """Create or update loan accounts and commit. Returns counts, errors and the audit row id.

    A record that cannot be processed is skipped and reported; a failed commit rolls the whole batch back and is
    reported as an error with zero created/updated.
    """
    sync_id = str(uuid.uuid4())
    created = updated = skipped = 0
    errors: List[str] = list(extra_errors or [])
    skipped += len(errors)

    existing_projects: Dict[str, Project] = {}
    for project_id_str in {item.project_id for item in items}:
        try:
            pid = uuid.UUID(project_id_str)
        except ValueError:
            errors.append(f"Invalid project UUID: {project_id_str}")
            continue
        project = (await db.execute(select(Project).where(Project.id == pid))).scalar_one_or_none()
        if project:
            existing_projects[project_id_str] = project
        else:
            errors.append(f"Project {project_id_str} not found")

    today = datetime.now().date()
    now_iso = datetime.utcnow().isoformat()

    for idx, item in enumerate(items, 1):
        try:
            if item.project_id not in existing_projects:
                errors.append(f"Record {idx}: Project {item.project_id} not found")
                skipped += 1
                continue

            project_id = uuid.UUID(item.project_id)
            existing_loan = (await db.execute(
                select(LoanAccount).where(
                    (LoanAccount.project_id == project_id) & (LoanAccount.facility_type == item.facility_type))
            )).scalar_one_or_none()

            if existing_loan:
                existing_loan.sanctioned_amount = item.sanctioned_amount
                existing_loan.disbursed_amount = item.disbursed_amount or item.sanctioned_amount
                existing_loan.outstanding_principal = item.outstanding_principal
                existing_loan.outstanding_interest = item.outstanding_interest or Decimal("0")
                existing_loan.interest_rate_pct = item.interest_rate_pct
                existing_loan.maturity_ad = item.maturity_date
                existing_loan.dscr = item.dscr
                existing_loan.ltv = item.ltv
                existing_loan.icr = item.icr
                existing_loan.metric_as_of_date = today
                existing_loan.last_synced_at = now_iso
                existing_loan.sync_status = "success"
                existing_loan.data_provenance = sync_source
                existing_loan.source_reference = source_reference
                db.add(existing_loan)
                updated += 1
            else:
                loan = LoanAccount(
                    id=uuid.uuid4(), project_id=project_id, finacle_account_id=f"SYNC-{uuid.uuid4().hex[:12]}",
                    facility_type=item.facility_type, sanctioned_amount=item.sanctioned_amount,
                    disbursed_amount=item.disbursed_amount or item.sanctioned_amount,
                    outstanding_principal=item.outstanding_principal,
                    outstanding_interest=item.outstanding_interest or Decimal("0"), currency_code="NPR",
                    fx_rate_to_npr=Decimal("131"), fx_rate_asof_ad=today, interest_rate_pct=item.interest_rate_pct,
                    moratorium_end_ad=item.disbursement_date, maturity_ad=item.maturity_date, dscr=item.dscr,
                    ltv=item.ltv, icr=item.icr, metric_as_of_date=today, last_synced_at=now_iso,
                    sync_status="success", data_provenance=sync_source, source_reference=source_reference,
                )
                db.add(loan)
                await db.flush()
                db.add(LoanAccountRateHistory(
                    id=uuid.uuid4(), loan_account_id=loan.id, interest_rate_pct=item.interest_rate_pct,
                    valid_from_ad=item.sanction_date, is_current="Y", data_provenance=sync_source,
                    source_reference=source_reference))
                created += 1
        except Exception as e:
            errors.append(f"Record {idx}: {str(e)[:100]}")
            skipped += 1
            logger.warning("Loan exposure record %d skipped: %s", idx, e)

    audit_id = sync_id
    try:
        entry = await append_audit_log(
            db, user_id=actor, user_role=actor_role, entity_type="LOAN_EXPOSURE_SYNC", entity_id=sync_id,
            action="sync", reason=f"Loan exposure ingest from {sync_source} ({source_reference or 'no reference'})",
            post_state={"created": created, "updated": updated, "skipped": skipped, "errors": len(errors)})
        audit_id = str(entry.id)
        await db.commit()
    except Exception as e:
        await db.rollback()
        errors.append(f"Database commit failed: {e}")
        created = updated = 0
        skipped = len(items)
        logger.error("Loan exposure commit failed: %s", e)

    return {
        "sync_id": sync_id,
        "total_records": total_submitted if total_submitted is not None else len(items),
        "created_count": created, "updated_count": updated, "skipped_count": skipped,
        "errors": errors, "warnings": [], "audit_log_id": audit_id,
        "timestamp": datetime.utcnow().isoformat(),
    }
