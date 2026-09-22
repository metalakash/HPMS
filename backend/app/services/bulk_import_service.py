"""Bulk import service for Excel/CSV file processing.

Handles file reading, row-by-row validation, batch transaction processing,
and detailed error reporting for compliance.
"""

import logging
from datetime import date, datetime
from typing import BinaryIO, List, Dict, Any, Optional, Tuple
from decimal import Decimal
import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from sqlalchemy.exc import IntegrityError

from backend.app.models.import_tracking import ImportBatch, ImportRowError, ImportStatus
from backend.app.models.project import Project, ProjectCapacityHistory
from backend.app.models.financial import LoanAccount, BudgetLine
from backend.app.services.validation_service import ValidationService, ValidationError

logger = logging.getLogger(__name__)


class BulkImportService:
    """Orchestrate bulk import operations with validation and error tracking."""

    def __init__(self, validation_service: Optional[ValidationService] = None):
        self.validation = validation_service or ValidationService()

    async def import_projects(
        self,
        db: AsyncSession,
        file_stream: BinaryIO,
        file_name: str,
        user_id: str = "SYSTEM",
    ) -> Tuple[ImportBatch, List[ImportRowError]]:
        """Import projects from Excel/CSV file.

        Args:
            db: async database session
            file_stream: binary file stream (Excel or CSV)
            file_name: original file name (for audit)
            user_id: who uploaded

        Returns:
            (ImportBatch, list of ImportRowError if any)
        """

        # Create import batch record
        batch = ImportBatch(
            id=uuid.uuid4(),
            file_name=file_name,
            import_type='projects',
            status=ImportStatus.PENDING.value,
            uploaded_by=user_id,
            upload_timestamp=date.today(),
        )

        db.add(batch)
        await db.flush()

        # Parse file (simplified: assume CSV for now)
        try:
            rows = await self._parse_csv(file_stream)
        except Exception as e:
            logger.error(f"Failed to parse file {file_name}: {e}")
            batch.status = ImportStatus.FAILED.value
            batch.error_summary = f"File parsing error: {str(e)}"
            await db.commit()
            return batch, []

        batch.total_rows = len(rows)

        # Validate all rows first
        errors: List[ImportRowError] = []
        existing_codes = set()

        for row_num, row_data in enumerate(rows, start=2):  # Start at 2 (header is row 1)
            validation_errors = self.validation.validate_project_row(
                row_num, row_data, existing_codes
            )

            if validation_errors:
                for error in validation_errors:
                    error_record = ImportRowError(
                        id=uuid.uuid4(),
                        batch_id=batch.id,
                        row_number=error.row_number,
                        error_type='validation',
                        column_name=error.column,
                        error_message=error.message,
                        row_data_json=json.dumps({k: str(v) for k, v in row_data.items()}),
                    )
                    db.add(error_record)
                    errors.append(error_record)
            else:
                existing_codes.add(str(row_data['project_code']).strip())

        if errors:
            batch.failed_rows = len(errors)
            batch.status = ImportStatus.VALIDATED.value  # Validation complete but errors found
            await db.commit()
            logger.warning(f"Import batch {batch.id}: {len(errors)} validation errors")
            return batch, errors

        # No validation errors - import data
        batch.status = ImportStatus.IN_PROGRESS.value
        start_time = datetime.utcnow()

        try:
            success_count = 0

            for row_num, row_data in enumerate(rows, start=2):
                try:
                    project = Project(
                        id=uuid.uuid4(),
                        project_code=str(row_data['project_code']).strip(),
                        name_en=str(row_data['name_en']).strip(),
                        name_np=str(row_data['name_np']).strip(),
                        province=str(row_data.get('province', '').strip()),
                        district=str(row_data.get('district', '').strip()),
                        local_level=str(row_data.get('local_level', '').strip()),
                        installed_capacity_mw=Decimal(str(row_data['capacity_mw'])),
                        project_stage=str(row_data['stage']).strip().lower(),
                        pipeline_status=str(row_data['status']).strip(),
                        created_by=user_id,
                        updated_by=user_id,
                    )

                    db.add(project)
                    success_count += 1

                except Exception as e:
                    logger.error(f"Row {row_num} import error: {e}")
                    error_record = ImportRowError(
                        id=uuid.uuid4(),
                        batch_id=batch.id,
                        row_number=row_num,
                        error_type='constraint',
                        error_message=f"Database error: {str(e)}",
                        row_data_json=json.dumps({k: str(v) for k, v in row_data.items()}),
                    )
                    db.add(error_record)
                    errors.append(error_record)

            # Try to commit
            await db.commit()

            batch.successful_rows = success_count
            batch.failed_rows = len(errors)
            batch.status = ImportStatus.COMPLETED.value if not errors else ImportStatus.PARTIAL.value
            batch.completed_at = date.today()
            batch.processing_duration_seconds = int((datetime.utcnow() - start_time).total_seconds())

            logger.info(f"Import batch {batch.id}: {success_count} rows imported, {len(errors)} errors")

        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Import batch {batch.id} failed on commit: {e}")
            batch.status = ImportStatus.FAILED.value
            batch.error_summary = f"Transaction failed: {str(e)}"
            await db.commit()
            return batch, errors

        return batch, errors

    async def import_loan_accounts(
        self,
        db: AsyncSession,
        file_stream: BinaryIO,
        file_name: str,
        user_id: str = "SYSTEM",
    ) -> Tuple[ImportBatch, List[ImportRowError]]:
        """Import loan accounts from Excel/CSV file.

        Args:
            db: async database session
            file_stream: binary file stream
            file_name: original file name
            user_id: who uploaded

        Returns:
            (ImportBatch, list of ImportRowError if any)
        """

        # Create import batch
        batch = ImportBatch(
            id=uuid.uuid4(),
            file_name=file_name,
            import_type='loans',
            status=ImportStatus.PENDING.value,
            uploaded_by=user_id,
            upload_timestamp=date.today(),
        )

        db.add(batch)
        await db.flush()

        # Parse file
        try:
            rows = await self._parse_csv(file_stream)
        except Exception as e:
            logger.error(f"Failed to parse file {file_name}: {e}")
            batch.status = ImportStatus.FAILED.value
            batch.error_summary = f"File parsing error: {str(e)}"
            await db.commit()
            return batch, []

        batch.total_rows = len(rows)

        # Validate all rows
        errors: List[ImportRowError] = []
        existing_account_ids = set()

        for row_num, row_data in enumerate(rows, start=2):
            # Resolve project_code to project_id
            project_code = row_data.get('project_code', '').strip()
            project_query = select(Project).where(Project.project_code == project_code)
            proj_result = await db.execute(project_query)
            project = proj_result.scalar_one_or_none()

            if not project:
                error_record = ImportRowError(
                    id=uuid.uuid4(),
                    batch_id=batch.id,
                    row_number=row_num,
                    error_type='not_found',
                    column_name='project_code',
                    error_message=f"Project code '{project_code}' not found",
                    row_data_json=json.dumps({k: str(v) for k, v in row_data.items()}),
                )
                db.add(error_record)
                errors.append(error_record)
                continue

            # Validate loan data
            validation_errors = self.validation.validate_loan_account_row(
                row_num, row_data, existing_account_ids
            )

            if validation_errors:
                for error in validation_errors:
                    error_record = ImportRowError(
                        id=uuid.uuid4(),
                        batch_id=batch.id,
                        row_number=error.row_number,
                        error_type='validation',
                        column_name=error.column,
                        error_message=error.message,
                        row_data_json=json.dumps({k: str(v) for k, v in row_data.items()}),
                    )
                    db.add(error_record)
                    errors.append(error_record)
            else:
                existing_account_ids.add(str(row_data['finacle_account_id']).strip())

        if errors:
            batch.failed_rows = len(errors)
            batch.status = ImportStatus.VALIDATED.value
            await db.commit()
            logger.warning(f"Import batch {batch.id}: {len(errors)} validation errors")
            return batch, errors

        # Import data
        batch.status = ImportStatus.IN_PROGRESS.value
        start_time = datetime.utcnow()

        try:
            success_count = 0

            for row_num, row_data in enumerate(rows, start=2):
                try:
                    # Resolve project again
                    project_code = row_data.get('project_code', '').strip()
                    project_query = select(Project).where(Project.project_code == project_code)
                    proj_result = await db.execute(project_query)
                    project = proj_result.scalar()

                    account = LoanAccount(
                        id=uuid.uuid4(),
                        project_id=project.id,
                        finacle_account_id=str(row_data['finacle_account_id']).strip(),
                        facility_type=str(row_data['facility_type']).strip(),
                        sanctioned_amount=Decimal(str(row_data['sanctioned_amount'])),
                        currency_code=row_data.get('currency_code', 'NPR'),
                        sync_status='manual',
                        data_provenance='MANUAL_ENTRY',
                        created_by=user_id,
                        updated_by=user_id,
                    )

                    db.add(account)
                    success_count += 1

                except Exception as e:
                    logger.error(f"Row {row_num} import error: {e}")
                    error_record = ImportRowError(
                        id=uuid.uuid4(),
                        batch_id=batch.id,
                        row_number=row_num,
                        error_type='constraint',
                        error_message=f"Database error: {str(e)}",
                        row_data_json=json.dumps({k: str(v) for k, v in row_data.items()}),
                    )
                    db.add(error_record)
                    errors.append(error_record)

            await db.commit()

            batch.successful_rows = success_count
            batch.failed_rows = len(errors)
            batch.status = ImportStatus.COMPLETED.value if not errors else ImportStatus.PARTIAL.value
            batch.completed_at = date.today()
            batch.processing_duration_seconds = int((datetime.utcnow() - start_time).total_seconds())

        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Import batch {batch.id} failed on commit: {e}")
            batch.status = ImportStatus.FAILED.value
            batch.error_summary = f"Transaction failed: {str(e)}"
            await db.commit()
            return batch, errors

        await db.commit()
        return batch, errors

    async def _parse_csv(self, file_stream: BinaryIO) -> List[Dict[str, Any]]:
        """Parse CSV file into list of dicts.

        Args:
            file_stream: binary file stream

        Returns:
            List of row dicts with column names as keys
        """

        import csv
        import io

        # Read file as text
        text_stream = io.TextIOWrapper(file_stream, encoding='utf-8-sig')
        reader = csv.DictReader(text_stream)

        rows = []
        for row in reader:
            # Clean up keys and values
            cleaned_row = {
                k.strip().lower().replace(' ', '_'): v.strip() if isinstance(v, str) else v
                for k, v in row.items()
            }
            rows.append(cleaned_row)

        return rows
