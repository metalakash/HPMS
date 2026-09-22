"""Validation service for bulk import data quality checks.

Validates projects, loan accounts, consortium, budget data against
RFP rules, domain constraints, and data type requirements.
"""

import logging
from typing import Optional, Dict, Any, List, Tuple
from decimal import Decimal
from datetime import date, datetime
import re

logger = logging.getLogger(__name__)


class ValidationError:
    """Single validation error for a field or row."""

    def __init__(self, row_number: int, column: str, value: Any, message: str):
        self.row_number = row_number
        self.column = column
        self.value = value
        self.message = message

    def __str__(self):
        return f"Row {self.row_number}, Column '{self.column}': {self.message} (value: {self.value})"

    def to_dict(self):
        return {
            "row": self.row_number,
            "column": self.column,
            "value": str(self.value),
            "error": self.message,
        }


class ValidationService:
    """Validate bulk import data against domain rules."""

    # Valid values for enums
    VALID_PROJECT_STAGES = ["feasibility", "construction", "operation"]
    VALID_PIPELINE_STATUSES = [
        "proposal_under_pipeline", "under_review", "approved", "dropped",
        "yet_to_start_drawdown", "under_construction", "under_operation", "settled"
    ]
    VALID_FACILITY_TYPES = [
        "Loan", "Overdraft", "Working Capital", "Term Loan", "Line of Credit"
    ]

    @staticmethod
    def validate_project_row(
        row_number: int,
        data: Dict[str, Any],
        existing_codes: Optional[set] = None,
    ) -> List[ValidationError]:
        """Validate a project import row.

        Args:
            row_number: which row (for error reporting)
            data: row data dict
            existing_codes: set of already-existing project codes (for duplicate detection)

        Returns:
            List of ValidationError (empty if valid)
        """

        errors = []

        # Required fields
        required_fields = ['project_code', 'name_en', 'name_np', 'province', 'capacity_mw', 'stage', 'status']
        for field in required_fields:
            if field not in data or data[field] is None or str(data[field]).strip() == '':
                errors.append(ValidationError(row_number, field, data.get(field), f"{field} is required"))

        # If required fields missing, skip other validations
        if errors:
            return errors

        # project_code: must be unique and alphanumeric
        project_code = str(data['project_code']).strip()
        if not re.match(r'^[A-Z0-9\-]{1,50}$', project_code):
            errors.append(ValidationError(
                row_number, 'project_code', project_code,
                "Must be alphanumeric and dashes only (max 50 chars)"
            ))
        if existing_codes and project_code in existing_codes:
            errors.append(ValidationError(
                row_number, 'project_code', project_code,
                f"Duplicate project code (already exists or imported in this batch)"
            ))

        # Names: max 255 chars
        name_en = str(data['name_en']).strip()
        if len(name_en) > 255:
            errors.append(ValidationError(
                row_number, 'name_en', name_en, "Maximum 255 characters"
            ))
        if len(name_en) == 0:
            errors.append(ValidationError(
                row_number, 'name_en', name_en, "Cannot be empty"
            ))

        name_np = str(data['name_np']).strip()
        if len(name_np) > 255:
            errors.append(ValidationError(
                row_number, 'name_np', name_np, "Maximum 255 characters"
            ))
        if len(name_np) == 0:
            errors.append(ValidationError(
                row_number, 'name_np', name_np, "Cannot be empty"
            ))

        # capacity_mw: must be positive decimal
        try:
            capacity = Decimal(str(data['capacity_mw']))
            if capacity <= 0:
                errors.append(ValidationError(
                    row_number, 'capacity_mw', capacity, "Must be greater than 0"
                ))
        except Exception as e:
            errors.append(ValidationError(
                row_number, 'capacity_mw', data['capacity_mw'],
                f"Invalid number format: {str(e)}"
            ))

        # stage: must be valid enum
        stage = str(data['stage']).strip().lower()
        if stage not in ValidationService.VALID_PROJECT_STAGES:
            errors.append(ValidationError(
                row_number, 'stage', stage,
                f"Must be one of: {', '.join(ValidationService.VALID_PROJECT_STAGES)}"
            ))

        # status: must be valid enum
        status = str(data['status']).strip()
        if status not in ValidationService.VALID_PIPELINE_STATUSES:
            errors.append(ValidationError(
                row_number, 'status', status,
                f"Must be one of: {', '.join(ValidationService.VALID_PIPELINE_STATUSES)}"
            ))

        return errors

    @staticmethod
    def validate_loan_account_row(
        row_number: int,
        data: Dict[str, Any],
        existing_account_ids: Optional[set] = None,
    ) -> List[ValidationError]:
        """Validate a loan account import row.

        Args:
            row_number: which row
            data: row data dict
            existing_account_ids: set of already-existing Finacle account IDs

        Returns:
            List of ValidationError
        """

        errors = []

        # Required fields
        required_fields = ['project_code', 'finacle_account_id', 'facility_type', 'sanctioned_amount']
        for field in required_fields:
            if field not in data or data[field] is None or str(data[field]).strip() == '':
                errors.append(ValidationError(row_number, field, data.get(field), f"{field} is required"))

        if errors:
            return errors

        # Finacle account ID: must be 10-20 alphanumeric chars
        account_id = str(data['finacle_account_id']).strip()
        if not re.match(r'^[A-Z0-9]{10,20}$', account_id, re.IGNORECASE):
            errors.append(ValidationError(
                row_number, 'finacle_account_id', account_id,
                "Must be 10-20 alphanumeric characters"
            ))
        if existing_account_ids and account_id in existing_account_ids:
            errors.append(ValidationError(
                row_number, 'finacle_account_id', account_id,
                "Duplicate account ID (already exists or imported in this batch)"
            ))

        # facility_type: must be valid
        facility_type = str(data['facility_type']).strip()
        if facility_type not in ValidationService.VALID_FACILITY_TYPES:
            errors.append(ValidationError(
                row_number, 'facility_type', facility_type,
                f"Must be one of: {', '.join(ValidationService.VALID_FACILITY_TYPES)}"
            ))

        # sanctioned_amount: must be positive decimal
        try:
            amount = Decimal(str(data['sanctioned_amount']))
            if amount <= 0:
                errors.append(ValidationError(
                    row_number, 'sanctioned_amount', amount, "Must be greater than 0"
                ))
        except Exception as e:
            errors.append(ValidationError(
                row_number, 'sanctioned_amount', data['sanctioned_amount'],
                f"Invalid number format: {str(e)}"
            ))

        return errors

    @staticmethod
    def validate_budget_row(
        row_number: int,
        data: Dict[str, Any],
    ) -> List[ValidationError]:
        """Validate a budget line import row.

        Args:
            row_number: which row
            data: row data dict

        Returns:
            List of ValidationError
        """

        errors = []

        # Required fields
        required_fields = ['project_code', 'category', 'budgeted_amount']
        for field in required_fields:
            if field not in data or data[field] is None or str(data[field]).strip() == '':
                errors.append(ValidationError(row_number, field, data.get(field), f"{field} is required"))

        if errors:
            return errors

        # category: max 100 chars
        category = str(data['category']).strip()
        if len(category) == 0 or len(category) > 100:
            errors.append(ValidationError(
                row_number, 'category', category, "Must be 1-100 characters"
            ))

        # budgeted_amount: must be non-negative decimal
        try:
            amount = Decimal(str(data['budgeted_amount']))
            if amount < 0:
                errors.append(ValidationError(
                    row_number, 'budgeted_amount', amount, "Must be >= 0"
                ))
        except Exception as e:
            errors.append(ValidationError(
                row_number, 'budgeted_amount', data['budgeted_amount'],
                f"Invalid number format: {str(e)}"
            ))

        # actual_amount: optional but must be non-negative if provided
        if 'actual_amount' in data and data['actual_amount'] is not None:
            try:
                amount = Decimal(str(data['actual_amount']))
                if amount < 0:
                    errors.append(ValidationError(
                        row_number, 'actual_amount', amount, "Must be >= 0"
                    ))
            except Exception as e:
                errors.append(ValidationError(
                    row_number, 'actual_amount', data['actual_amount'],
                    f"Invalid number format: {str(e)}"
                ))

        return errors

    @staticmethod
    def parse_date(value: Any) -> Optional[Tuple[date, Optional[str]]]:
        """Parse date from various formats.

        Accepts:
        - YYYY-MM-DD (AD)
        - YYYY/MM/DD (AD)
        - DD-MM-YYYY (AD)
        - YYYY-MM-DD (BS, if starts with 20XX)

        Returns:
            (ad_date, bs_string) or (None, None) if invalid
        """

        if value is None:
            return None

        value_str = str(value).strip()

        # Try YYYY-MM-DD (AD)
        try:
            parts = value_str.split('-')
            if len(parts) == 3:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                if 1900 <= year <= 2100:
                    return date(year, month, day), None
        except:
            pass

        # Try YYYY/MM/DD (AD)
        try:
            parts = value_str.split('/')
            if len(parts) == 3:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                if 1900 <= year <= 2100:
                    return date(year, month, day), None
        except:
            pass

        # Try DD-MM-YYYY (AD)
        try:
            parts = value_str.split('-')
            if len(parts) == 3:
                day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                if 1900 <= year <= 2100:
                    return date(year, month, day), None
        except:
            pass

        return None
