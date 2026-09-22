"""Tests for PDF report generation."""

import pytest
from io import BytesIO

from backend.app.services.pdf_service import PDFService, ReportType


class TestPDFGeneration:
    """Test PDF generation for different report types."""

    def test_portfolio_pdf_generation(self):
        """Test portfolio PDF generation."""
        project_data = {
            "total_projects": 5,
            "total_capacity_mw": 250.0,
            "active_projects": 4,
            "average_rate": 8.5,
            "projects": [
                {
                    "name": "Project A",
                    "capacity_mw": 50.0,
                    "status": "active",
                    "rate": 8.5,
                },
                {
                    "name": "Project B",
                    "capacity_mw": 75.0,
                    "status": "active",
                    "rate": 8.75,
                },
            ],
        }

        pdf_bytes = PDFService.generate_portfolio_report(project_data)

        assert pdf_bytes is not None
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        # PDF magic bytes
        assert pdf_bytes[:4] == b"%PDF"

    def test_portfolio_pdf_with_metadata(self):
        """Test portfolio PDF with custom metadata."""
        project_data = {"total_projects": 1, "total_capacity_mw": 50.0}
        metadata = {
            "title": "Test Portfolio Report",
            "author": "Test Author",
            "subject": "Test Subject",
        }

        pdf_bytes = PDFService.generate_portfolio_report(project_data, metadata)

        assert pdf_bytes is not None
        assert pdf_bytes[:4] == b"%PDF"

    def test_covenant_pdf_generation(self):
        """Test covenant compliance PDF generation."""
        covenant_data = {
            "dscr": 1.35,
            "dscr_threshold": 1.25,
            "dscr_pass": True,
            "ltv": 65.0,
            "ltv_threshold": 70.0,
            "ltv_pass": True,
            "icr": 2.5,
            "icr_threshold": 2.0,
            "icr_pass": True,
        }

        pdf_bytes = PDFService.generate_covenant_report(covenant_data)

        assert pdf_bytes is not None
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        assert pdf_bytes[:4] == b"%PDF"

    def test_covenant_pdf_with_failures(self):
        """Test covenant PDF with failed metrics."""
        covenant_data = {
            "dscr": 1.1,
            "dscr_threshold": 1.25,
            "dscr_pass": False,
            "ltv": 75.0,
            "ltv_threshold": 70.0,
            "ltv_pass": False,
            "icr": 1.8,
            "icr_threshold": 2.0,
            "icr_pass": False,
        }

        pdf_bytes = PDFService.generate_covenant_report(covenant_data)

        assert pdf_bytes is not None
        assert pdf_bytes[:4] == b"%PDF"

    def test_capex_pdf_generation(self):
        """Test CapEx report PDF generation."""
        capex_data = {
            "civil_budgeted": 1000000,
            "civil_spent": 750000,
            "civil_remaining": 250000,
            "civil_pct": 75.0,
            "equip_budgeted": 500000,
            "equip_spent": 400000,
            "equip_remaining": 100000,
            "equip_pct": 80.0,
            "cont_budgeted": 200000,
            "cont_spent": 50000,
            "cont_remaining": 150000,
            "cont_pct": 25.0,
            "total_budgeted": 1700000,
            "total_spent": 1200000,
            "total_remaining": 500000,
            "total_pct": 70.6,
        }

        pdf_bytes = PDFService.generate_capex_report(capex_data)

        assert pdf_bytes is not None
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        assert pdf_bytes[:4] == b"%PDF"

    def test_capex_pdf_zero_budget(self):
        """Test CapEx PDF with zero budget."""
        capex_data = {
            "civil_budgeted": 0,
            "civil_spent": 0,
            "civil_remaining": 0,
            "civil_pct": 0,
            "equip_budgeted": 0,
            "equip_spent": 0,
            "equip_remaining": 0,
            "equip_pct": 0,
            "cont_budgeted": 0,
            "cont_spent": 0,
            "cont_remaining": 0,
            "cont_pct": 0,
            "total_budgeted": 0,
            "total_spent": 0,
            "total_remaining": 0,
            "total_pct": 0,
        }

        pdf_bytes = PDFService.generate_capex_report(capex_data)

        assert pdf_bytes is not None
        assert pdf_bytes[:4] == b"%PDF"


class TestPDFBranding:
    """Test SBL branding in PDF."""

    def test_company_name_in_pdf(self):
        """Test that company name is used in PDF generation."""
        assert PDFService.COMPANY_NAME == "Sustainable Bank Limited (SBL)"

    def test_color_constants(self):
        """Test that branding colors are defined."""
        assert PDFService.COLOR_PRIMARY == "#1F4788"  # SBL Blue
        assert PDFService.COLOR_SECONDARY == "#2E7D32"  # SBL Green
        assert PDFService.COLOR_ACCENT == "#F57C00"  # SBL Orange

    def test_page_margins(self):
        """Test page margin settings."""
        assert PDFService.PAGE_WIDTH == 612  # 8.5 inches
        assert PDFService.PAGE_HEIGHT == 792  # 11 inches
        assert PDFService.MARGIN_TOP == 72  # 1 inch
        assert PDFService.MARGIN_BOTTOM == 72  # 1 inch


class TestPDFDataHandling:
    """Test PDF handling of various data formats."""

    def test_empty_project_data(self):
        """Test PDF generation with empty project data."""
        project_data = {
            "total_projects": 0,
            "total_capacity_mw": 0,
            "active_projects": 0,
            "average_rate": 0,
            "projects": [],
        }

        pdf_bytes = PDFService.generate_portfolio_report(project_data)

        assert pdf_bytes is not None
        assert pdf_bytes[:4] == b"%PDF"

    def test_large_numbers_in_capex(self):
        """Test CapEx PDF with large numbers."""
        capex_data = {
            "civil_budgeted": 50000000,
            "civil_spent": 45000000,
            "civil_remaining": 5000000,
            "civil_pct": 90.0,
            "equip_budgeted": 25000000,
            "equip_spent": 20000000,
            "equip_remaining": 5000000,
            "equip_pct": 80.0,
            "cont_budgeted": 10000000,
            "cont_spent": 5000000,
            "cont_remaining": 5000000,
            "cont_pct": 50.0,
            "total_budgeted": 85000000,
            "total_spent": 70000000,
            "total_remaining": 15000000,
            "total_pct": 82.4,
        }

        pdf_bytes = PDFService.generate_capex_report(capex_data)

        assert pdf_bytes is not None
        assert pdf_bytes[:4] == b"%PDF"

    def test_special_characters_in_project_name(self):
        """Test PDF generation with special characters."""
        project_data = {
            "total_projects": 1,
            "total_capacity_mw": 50.0,
            "active_projects": 1,
            "average_rate": 8.5,
            "projects": [
                {
                    "name": "Project A & B (Phase I/II)",
                    "capacity_mw": 50.0,
                    "status": "active",
                    "rate": 8.5,
                },
            ],
        }

        pdf_bytes = PDFService.generate_portfolio_report(project_data)

        assert pdf_bytes is not None
        assert pdf_bytes[:4] == b"%PDF"


class TestWatermarkEncryption:
    """Test watermark and encryption features (Phase 4.5)."""

    def test_add_watermark(self):
        """Test watermark addition (Phase 4.5 feature)."""
        pdf_bytes = b"%PDF-1.4\n%minimal PDF"

        result = PDFService.add_watermark(pdf_bytes, "CONFIDENTIAL")

        # Should return bytes (watermark not yet implemented)
        assert isinstance(result, bytes)

    def test_encrypt_pdf(self):
        """Test PDF encryption (Phase 4.5 feature)."""
        pdf_bytes = b"%PDF-1.4\n%minimal PDF"

        result = PDFService.encrypt_pdf(pdf_bytes, "password123")

        # Should return bytes (encryption not yet implemented)
        assert isinstance(result, bytes)


class TestReportTypes:
    """Test report type enum."""

    def test_report_type_values(self):
        """Test report type enum values."""
        assert ReportType.PORTFOLIO.value == "portfolio"
        assert ReportType.COVENANT.value == "covenant"
        assert ReportType.CAPEX.value == "capex"
        assert ReportType.SUMMARY.value == "summary"

    def test_report_type_string_conversion(self):
        """Test report type conversion to string."""
        assert str(ReportType.PORTFOLIO) == "ReportType.portfolio"
        assert ReportType.PORTFOLIO.value in str(ReportType.PORTFOLIO)


class TestPDFPerformance:
    """Test PDF generation performance."""

    def test_portfolio_pdf_generation_completes(self):
        """Test that portfolio PDF generation completes without timeout."""
        project_data = {
            "total_projects": 100,
            "total_capacity_mw": 5000.0,
            "active_projects": 95,
            "average_rate": 8.5,
            "projects": [
                {
                    "name": f"Project {i}",
                    "capacity_mw": 50.0,
                    "status": "active",
                    "rate": 8.5,
                }
                for i in range(100)
            ],
        }

        pdf_bytes = PDFService.generate_portfolio_report(project_data)

        assert pdf_bytes is not None
        assert len(pdf_bytes) > 1000  # Reasonable size

    def test_pdf_size_reasonable(self):
        """Test that generated PDFs have reasonable file size."""
        project_data = {"total_projects": 10, "total_capacity_mw": 500.0}

        pdf_bytes = PDFService.generate_portfolio_report(project_data)

        # PDF should be at least 1KB but not unreasonably large
        assert len(pdf_bytes) > 1000
        assert len(pdf_bytes) < 5000000  # 5MB max
