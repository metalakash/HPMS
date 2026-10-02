"""MFA secrets are encrypted at rest and backup codes are keyed hashes."""

import hashlib

import pytest

from backend.app.security import secret_box as sb
from backend.app.services.mfa_service import MFAService


@pytest.fixture
def keys(monkeypatch):
    from backend.app.config import settings

    def set_keys(primary="primary-key-material", old=""):
        monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", primary)
        monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY_OLD", old)
    set_keys()
    return set_keys


def test_roundtrip_and_ciphertext_hides_the_secret(keys):
    stored = sb.encrypt("JBSWY3DPEHPK3PXP")
    assert stored.startswith("enc1:") and "JBSWY3DPEHPK3PXP" not in stored
    assert sb.decrypt(stored) == "JBSWY3DPEHPK3PXP"
    assert sb.encrypt("JBSWY3DPEHPK3PXP") != stored  # random IV: no equal-plaintext leak


def test_none_and_already_encrypted_values_pass_through(keys):
    assert sb.encrypt(None) is None and sb.decrypt(None) is None
    stored = sb.encrypt("abc")
    assert sb.encrypt(stored) == stored  # never double-encrypt


def test_legacy_plain_text_rows_stay_readable(keys):
    assert sb.decrypt("JBSWY3DPEHPK3PXP") == "JBSWY3DPEHPK3PXP"


def test_wrong_key_fails_loudly_instead_of_returning_garbage(keys):
    stored = sb.encrypt("secret")
    keys("a-completely-different-key")
    with pytest.raises(ValueError, match="cannot be decrypted"):
        sb.decrypt(stored)


def test_key_rotation_with_old_key_listed(keys):
    stored = sb.encrypt("secret")
    keys(primary="new-key", old="primary-key-material")
    assert sb.decrypt(stored) == "secret"          # old ciphertext still readable
    assert sb.decrypt(sb.encrypt("x")) == "x"      # new writes use the new key
    keys(primary="new-key", old="")
    with pytest.raises(ValueError):
        sb.decrypt(stored)                          # once the old key is dropped it is gone


def test_falls_back_to_secret_key_when_no_dedicated_key(monkeypatch):
    from backend.app.config import settings
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", "")
    monkeypatch.setattr(settings, "SECRET_KEY", "service-secret")
    stored = sb.encrypt("v")
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", "service-secret")  # same material -> same derived key
    assert sb.decrypt(stored) == "v"


def test_column_type_encrypts_on_bind_and_decrypts_on_read(keys):
    t = sb.EncryptedString()
    bound = t.process_bind_param("SEED", None)
    assert bound.startswith("enc1:") and bound != "SEED"
    assert t.process_result_value(bound, None) == "SEED"
    assert t.process_result_value("LEGACYPLAIN", None) == "LEGACYPLAIN"
    assert t.process_bind_param(None, None) is None


def test_encrypted_column_is_wide_enough():
    from backend.app.models.mfa import BackupCode, UserMFA
    assert UserMFA.__table__.c.totp_secret.type.impl.length >= 120   # 16-char seed -> ~120 chars of token
    assert BackupCode.__table__.c.code.type.length == 64             # a hex SHA-256 / HMAC digest
    assert len(sb.encrypt("A" * 32)) <= 255


# ------------------------------------------------------------------ backup codes

def test_backup_code_hash_is_keyed_normalised_and_fits_the_column(keys):
    h = MFAService.hash_backup_code("ab12-cd34")
    assert len(h) == 64 and h == MFAService.hash_backup_code(" AB12-CD34 ")
    assert h != hashlib.sha256(b"AB12-CD34").hexdigest()  # not the offline-crackable plain digest
    keys("another-key")
    assert MFAService.hash_backup_code("AB12-CD34") != h


def test_verify_backup_code_accepts_keyed_and_legacy_hashes_only_for_the_right_code(keys):
    stored = MFAService.hash_backup_code("AB12-CD34")
    assert MFAService.verify_backup_code(stored, "ab12-cd34")
    assert not MFAService.verify_backup_code(stored, "AB12-CD35")
    legacy = hashlib.sha256(b"AB12-CD34").hexdigest()
    assert MFAService.verify_backup_code(legacy, "AB12-CD34") and not MFAService.verify_backup_code(legacy, "ZZZZ-ZZZZ")
