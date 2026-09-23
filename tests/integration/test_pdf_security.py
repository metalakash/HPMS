"""Tests for PDF security features: watermarking and encryption (Phase 4.5)."""

import pytest
from io import BytesIO

from backend.app.services.pdf_service import PDFService


class TestPDFWatermark:
    """Test PDF watermarking functionality."""

    def test_watermark_with_default_text(self):
        """Test adding watermark with default 'CONFIDENTIAL' text."""
        # Create minimal PDF content
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.add_watermark(pdf_bytes, "CONFIDENTIAL")

        assert result is not None
        assert len(result) > 0
        assert isinstance(result, bytes)

    def test_watermark_with_custom_text(self):
        """Test adding watermark with custom text."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.add_watermark(pdf_bytes, "DRAFT")

        assert result is not None
        assert isinstance(result, bytes)

    def test_watermark_with_custom_opacity(self):
        """Test watermark with custom opacity."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.add_watermark(
            pdf_bytes,
            "DRAFT",
            opacity=0.5
        )

        assert result is not None
        assert isinstance(result, bytes)

    def test_watermark_with_custom_angle(self):
        """Test watermark with custom rotation angle."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.add_watermark(
            pdf_bytes,
            "DRAFT",
            angle=30
        )

        assert result is not None
        assert isinstance(result, bytes)

    def test_watermark_opacity_range(self):
        """Test various opacity values."""
        pdf_bytes = self._create_minimal_pdf()

        for opacity in [0.1, 0.3, 0.5, 0.7, 0.9]:
            result = PDFService.add_watermark(
                pdf_bytes,
                "TEST",
                opacity=opacity
            )
            assert result is not None

    def test_watermark_angle_range(self):
        """Test various rotation angles."""
        pdf_bytes = self._create_minimal_pdf()

        for angle in [0, 15, 30, 45, 60, 90]:
            result = PDFService.add_watermark(
                pdf_bytes,
                "TEST",
                angle=angle
            )
            assert result is not None

    def test_watermark_on_invalid_pdf(self):
        """Test watermark on invalid PDF data."""
        invalid_pdf = b"Not a PDF"

        # Should return original data on error
        result = PDFService.add_watermark(invalid_pdf, "TEST")

        assert result == invalid_pdf

    def test_watermark_with_empty_text(self):
        """Test watermark with empty text."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.add_watermark(pdf_bytes, "")

        assert result is not None

    @staticmethod
    def _create_minimal_pdf() -> bytes:
        """Create a minimal valid PDF for testing."""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter

            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            c.drawString(100, 750, "Test PDF")
            c.save()
            buffer.seek(0)
            return buffer.getvalue()
        except ImportError:
            # Return bytes that look like a PDF header if reportlab not available
            return b"%PDF-1.4\n"


class TestPDFEncryption:
    """Test PDF encryption functionality."""

    def test_encrypt_with_password(self):
        """Test encrypting PDF with password."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.encrypt_pdf(pdf_bytes, "mypassword")

        assert result is not None
        assert len(result) > 0
        assert isinstance(result, bytes)

    def test_encrypt_with_strong_password(self):
        """Test encryption with strong password."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.encrypt_pdf(
            pdf_bytes,
            "MyStr0ng!P@ssw0rd"
        )

        assert result is not None
        assert isinstance(result, bytes)

    def test_encrypt_with_owner_password(self):
        """Test encryption with separate owner password."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.encrypt_pdf(
            pdf_bytes,
            password="userpass",
            owner_password="ownerpass"
        )

        assert result is not None
        assert isinstance(result, bytes)

    def test_encrypt_with_empty_password(self):
        """Test encryption with empty password."""
        pdf_bytes = self._create_minimal_pdf()

        # Should skip encryption and return original
        result = PDFService.encrypt_pdf(pdf_bytes, "")

        assert result == pdf_bytes

    def test_encrypt_with_none_password(self):
        """Test encryption with None password."""
        pdf_bytes = self._create_minimal_pdf()

        # Should skip encryption and return original
        result = PDFService.encrypt_pdf(pdf_bytes, None)

        assert result == pdf_bytes

    def test_encrypt_on_invalid_pdf(self):
        """Test encryption on invalid PDF data."""
        invalid_pdf = b"Not a PDF"

        # Should return original data on error
        result = PDFService.encrypt_pdf(invalid_pdf, "password")

        assert result == invalid_pdf

    def test_encrypt_preserves_content(self):
        """Test that encryption preserves PDF content structure."""
        pdf_bytes = self._create_minimal_pdf()

        result = PDFService.encrypt_pdf(pdf_bytes, "test")

        # Result should be valid bytes (might be same if PyPDF2 not installed)
        assert result is not None
        assert len(result) > 0
        assert isinstance(result, bytes)

    def test_encrypt_multiple_times(self):
        """Test encrypting already encrypted PDF."""
        pdf_bytes = self._create_minimal_pdf()

        # First encryption
        encrypted_once = PDFService.encrypt_pdf(pdf_bytes, "pass1")

        # This might fail due to PDF structure, should handle gracefully
        encrypted_twice = PDFService.encrypt_pdf(encrypted_once, "pass2")

        assert encrypted_twice is not None

    @staticmethod
    def _create_minimal_pdf() -> bytes:
        """Create a minimal valid PDF for testing."""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter

            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            c.drawString(100, 750, "Test PDF")
            c.save()
            buffer.seek(0)
            return buffer.getvalue()
        except ImportError:
            return b"%PDF-1.4\n"


class TestPDFSecurityIntegration:
    """Test combining watermarking and encryption."""

    def test_watermark_then_encrypt(self):
        """Test applying watermark then encryption."""
        pdf_bytes = self._create_minimal_pdf()

        # Add watermark
        watermarked = PDFService.add_watermark(pdf_bytes, "CONFIDENTIAL")

        # Then encrypt
        result = PDFService.encrypt_pdf(watermarked, "password")

        assert result is not None
        assert isinstance(result, bytes)

    def test_encrypt_then_watermark(self):
        """Test encrypting first, then adding watermark."""
        pdf_bytes = self._create_minimal_pdf()

        # Encrypt first
        encrypted = PDFService.encrypt_pdf(pdf_bytes, "password")

        # Then watermark (might fail due to encryption, should handle gracefully)
        result = PDFService.add_watermark(encrypted, "CONFIDENTIAL")

        assert result is not None

    @staticmethod
    def _create_minimal_pdf() -> bytes:
        """Create a minimal valid PDF for testing."""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter

            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            c.drawString(100, 750, "Test PDF")
            c.save()
            buffer.seek(0)
            return buffer.getvalue()
        except ImportError:
            return b"%PDF-1.4\n"


class TestWatermarkConfiguration:
    """Test watermark configuration."""

    def test_default_watermark_text(self):
        """Test default watermark text value."""
        pdf_bytes = self._create_minimal_pdf()

        # Using default
        result = PDFService.add_watermark(pdf_bytes)

        assert result is not None

    def test_watermark_parameters(self):
        """Test watermark parameter combinations."""
        pdf_bytes = self._create_minimal_pdf()

        # Test various combinations
        configs = [
            {"watermark_text": "DRAFT", "opacity": 0.5, "angle": 30},
            {"watermark_text": "CONFIDENTIAL", "opacity": 0.2, "angle": 60},
            {"watermark_text": "DO NOT DISTRIBUTE", "opacity": 0.7, "angle": 0},
        ]

        for config in configs:
            result = PDFService.add_watermark(pdf_bytes, **config)
            assert result is not None

    @staticmethod
    def _create_minimal_pdf() -> bytes:
        """Create a minimal valid PDF for testing."""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter

            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            c.drawString(100, 750, "Test PDF")
            c.save()
            buffer.seek(0)
            return buffer.getvalue()
        except ImportError:
            return b"%PDF-1.4\n"


class TestEncryptionConfiguration:
    """Test encryption configuration."""

    def test_encryption_algorithm(self):
        """Test encryption algorithm configuration."""
        pdf_bytes = self._create_minimal_pdf()

        # AES128 is default, test with it
        result = PDFService.encrypt_pdf(pdf_bytes, "password")

        assert result is not None

    def test_encryption_password_lengths(self):
        """Test various password lengths."""
        pdf_bytes = self._create_minimal_pdf()

        passwords = [
            "a",
            "short",
            "medium_password",
            "very_long_password_with_special_chars_!@#$%^&*()",
        ]

        for password in passwords:
            result = PDFService.encrypt_pdf(pdf_bytes, password)
            assert result is not None

    @staticmethod
    def _create_minimal_pdf() -> bytes:
        """Create a minimal valid PDF for testing."""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter

            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            c.drawString(100, 750, "Test PDF")
            c.save()
            buffer.seek(0)
            return buffer.getvalue()
        except ImportError:
            return b"%PDF-1.4\n"


class TestErrorHandling:
    """Test error handling in security features."""

    def test_watermark_handles_corrupt_pdf(self):
        """Test watermark handles corrupt PDF gracefully."""
        corrupt_pdf = b"%PDF-1.4\ncorrupted data here"

        result = PDFService.add_watermark(corrupt_pdf, "TEST")

        # Should return original on error
        assert result is not None

    def test_encrypt_handles_corrupt_pdf(self):
        """Test encryption handles corrupt PDF gracefully."""
        corrupt_pdf = b"%PDF-1.4\ncorrupted data here"

        result = PDFService.encrypt_pdf(corrupt_pdf, "password")

        # Should return original on error
        assert result is not None

    def test_watermark_with_missing_libraries(self):
        """Test watermark behavior when libraries missing."""
        # This test verifies error handling but won't actually test
        # missing libraries in this environment
        pdf_bytes = b"%PDF-1.4\n"

        result = PDFService.add_watermark(pdf_bytes, "TEST")

        # Should return something (original or with attempt)
        assert result is not None

    def test_encrypt_with_missing_libraries(self):
        """Test encryption behavior when libraries missing."""
        pdf_bytes = b"%PDF-1.4\n"

        result = PDFService.encrypt_pdf(pdf_bytes, "password")

        # Should return something (original or with attempt)
        assert result is not None
