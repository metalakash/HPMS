"""RFP TECH D.12: the parameter reference is current, so it lists only what the code reads."""

from backend.scripts import generate_parameter_reference as gen


def test_committed_parameter_reference_is_up_to_date():
    current = gen.OUTPUT.read_text(encoding="utf-8").replace("\r\n", "\n")
    assert current == gen.render(), (
        "docs/PARAMETER-REFERENCE.md is stale; run: python -m backend.scripts.generate_parameter_reference")


def test_unread_settings_are_reported_as_having_no_effect():
    text = gen.render()
    unread = text.split("## 6.")[1]
    assert "`PDF_FONT`" in unread  # defined in config.py, read by nothing
    assert "`DOCUMENT_MAX_MB`" not in unread and "`DOCUMENT_MAX_MB`" in text.split("## 6.")[0]
