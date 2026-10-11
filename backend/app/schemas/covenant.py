"""Request bodies for covenant inputs. Shared by the routes and by change-request approval."""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

Amount = Optional[Decimal]


class FinancialPeriodRequest(BaseModel):
    """One quarter of the borrower's figures in NPR. Leave income fields out before commercial operation."""

    revenue_npr: Amount = None
    operating_expenses_npr: Amount = None
    royalty_npr: Amount = None
    tax_paid_npr: Amount = None
    depreciation_npr: Amount = None
    security_value_npr: Amount = Field(None, description="Value of the security at the period end")
    is_audited: bool = False
    source_reference: str = Field(min_length=3, max_length=255,
                                  description="Where the figures come from, e.g. the accounts or valuation report")


class CovenantTermsRequest(BaseModel):
    dscr_min: Decimal
    ltv_max: Decimal
    icr_min: Decimal
    warning_margin_pct: Decimal = Decimal("8")
    source_reference: str = Field(min_length=3, max_length=255, description="Sanction letter or agreement reference")
