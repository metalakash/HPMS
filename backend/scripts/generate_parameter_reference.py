"""Generate docs/PARAMETER-REFERENCE.md from the code (RFP TECH D.12, parameterisation).

    python -m backend.scripts.generate_parameter_reference            # rewrite the committed file
    python -m backend.scripts.generate_parameter_reference --check    # exit 1 if the file is out of date

Everything listed is read from the code that uses it, so the document cannot claim a parameter that does
nothing: environment settings are split into those some code reads and those defined but read by nothing,
and the admin settings, approval rules, change types and field rights come from the modules that enforce
them. tests/test_parameter_reference.py fails when the committed file is stale.
"""

import argparse
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "PARAMETER-REFERENCE.md"
CONFIG = ROOT / "backend" / "app" / "config.py"

# Environment settings that hold a secret: the reference names them but never shows a default
SECRETS = {"SECRET_KEY", "JWT_SECRET_KEY", "AD_SERVICE_ACCOUNT_PASSWORD", "MFA_ENCRYPTION_KEY", "MFA_ENCRYPTION_KEY_OLD",
           "CBS_HTTP_AUTH_VALUE", "S3_SECRET_ACCESS_KEY", "S3_ACCESS_KEY_ID", "PDF_ENCRYPTION_DEFAULT_PASSWORD",
           "DATABASE_URL", "REDIS_URL"}

# Area of each environment setting, by name prefix (first match wins)
AREAS = [
    ("DATABASE_", "Database"), ("SECRET_KEY", "Sign-in tokens"), ("ALGORITHM", "Sign-in tokens"), ("JWT_", "Sign-in tokens"),
    ("USE_LDAP", "Directory sign-in"), ("AD_", "Directory sign-in"), ("ALLOW_DEV_AUTH", "Demo"), ("DEMO_", "Demo"),
    ("DB_ROW_SECURITY", "Data security"), ("MFA_", "Multi-factor authentication"), ("DEBUG", "Application"),
    ("LOG_LEVEL", "Application"), ("ADMIN_", "Network access"), ("TRUSTED_PROXY", "Network access"),
    ("CBS_", "Core banking"), ("DOCUMENT_", "Documents"), ("AUDIT_", "Audit log"), ("S3_", "Export files"),
    ("STORAGE_BACKEND", "Export files"), ("EXPORT_", "Export files"), ("PRESIGNED_", "Export files"),
    ("MAX_EXPORT", "Export files"), ("RATE_LIMIT", "Rate limiting"), ("CACHE_", "Caching"), ("PDF_", "PDF reports"),
    ("WEBSOCKET_", "Live notifications"), ("REDIS_", "Live notifications"),
]


def _area(name: str) -> str:
    return next((area for prefix, area in AREAS if name.startswith(prefix)), "Other")


def _env_settings() -> List[Tuple[str, str, str, str]]:
    """(area, name, default, description) for every setting in config.py, in file order. A comment directly
    above a setting (no blank line between) and one at the end of its line describe it."""
    raw = CONFIG.read_text(encoding="utf-8").splitlines()
    # A setting whose getenv call runs over several lines is read as one line
    lines: List[str] = []
    for line in raw:
        if lines and lines[-1].count("(") > lines[-1].count(")"):
            lines[-1] += " " + line.strip()
        else:
            lines.append(line)
    comments: List[str] = []
    out = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            text = stripped.lstrip("# ").strip()
            # A short label ("Database", "JWT Token") heads a group of settings; it describes none of them
            if len(text.split()) > 6 or any(mark in text for mark in ".;:=,"):
                comments.append(text)
            continue
        match = re.match(r"^    ([A-Z][A-Z0-9_]+):\s*[^=]+=\s*(.*)$", line)
        if not match:
            comments = []
            continue
        name, rest = match.groups()
        default = ""
        found = re.search(r'os\.getenv\(\s*"[A-Z0-9_]+"\s*,\s*"([^"]*)"', rest)
        if found:
            default = found.group(1)
        elif rest.strip().startswith('"'):
            default = rest.strip().split('"')[1]
        elif rest.strip() == "None":
            default = "(unset)"
        trailing = rest.split("  # ", 1)[1].strip() if "  # " in rest else ""
        out.append((_area(name), name, default, " ".join(comments + ([trailing] if trailing else [])).strip()))
        comments = []
    return out


def _readers() -> Dict[str, List[str]]:
    """Setting name -> the backend modules that read it (config.py itself excluded)."""
    names = [n for _, n, _, _ in _env_settings()]
    found: Dict[str, List[str]] = {n: [] for n in names}
    for path in sorted((ROOT / "backend").rglob("*.py")):
        if path in (CONFIG, Path(__file__).resolve()) or "__pycache__" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        relative = path.relative_to(ROOT).as_posix()
        for name in names:
            if re.search(rf"\b{name}\b", text):
                found[name].append(relative)
    return found


def _cell(text: str) -> str:
    return (text or "").replace("|", "\\|").replace("\n", " ")


def render() -> str:
    import backend.app.models  # noqa: F401
    from backend.app.security.field_policy import POLICY
    from backend.app.security.read_policy import READ_POLICY
    from backend.app.services import app_settings, approval_rules, change_kinds

    out: List[str] = [
        "# HPMS Parameter Reference",
        "",
        "Generated from the code by `python -m backend.scripts.generate_parameter_reference`; do not edit by hand.",
        "Every value below is read by the code that uses it. The system study (`SYSTEM-STUDY.md`) explains how the",
        "parts fit together.",
        "",
        "## 1. Settings an administrator changes in the application",
        "",
        "On the Settings page. A change is a change request (type `SETTING`): proposed by an administrator, final",
        "approval by a different administrator unless the approval rule is changed. Stored only when different from",
        "the default (`app_parameters`).",
        "",
        "| Setting | Area | Default | Allowed | Controls |",
        "|---|---|---|---|---|",
    ]
    for s in app_settings.SETTINGS.values():
        out.append(f"| `{s.name}` | {s.group} | {s.default} {s.unit} | {s.minimum} to {s.maximum} {s.unit} | {_cell(s.description)} |")

    out += ["", "## 2. Approval rules", "",
            "Who decides each type of change request, on the Settings page. A rule change is itself a change request",
            "(`APPROVAL_RULE`). A request keeps the rule in force when it was raised. Whatever the rule, nobody checks",
            "their own change and the two checks of a two-step rule come from different people.", "",
            "| Change type | What it changes | Default checks | Recommended by | Final approval by |", "|---|---|---|---|---|"]
    for entity_type, label in approval_rules.CHANGE_TYPES.items():
        rule = approval_rules.default_rule(entity_type)
        out.append(f"| `{entity_type}` | {label} | {len(rule['steps']) - 1} | {', '.join(rule['recommend_roles'])} | "
                   f"{', '.join(rule['approve_roles'])} |")

    change_kinds._load()
    out += ["", "## 3. Who may propose each change", "",
            "| Change type | Proposed by | Scope |", "|---|---|---|",
            "| `PROJECT`, `LOAN` | maker, admin (on projects they may update) | a project or loan |",
            "| `FINANCIAL_PERIOD` | maker, admin | a project |",
            "| `COVENANT_TERMS` | admin | a project |"]
    for kind in sorted(change_kinds._KINDS.values(), key=lambda k: k.name):
        out.append(f"| `{kind.name}` | {', '.join(sorted(kind.author_roles))} | "
                   f"{'a project the proposer may update' if kind.project_scoped else 'bank-wide'} |")

    out += ["", "## 4. Field-level rights", "", "### Write (fields a change request may name)", "",
            "| Change type | Field | Who may propose it | Why |", "|---|---|---|---|"]
    for entity_type, rules in POLICY.items():
        for field, rule in rules.items():
            who = ", ".join(sorted(rule.write_roles)) or "no one (owned by another system)"
            out.append(f"| `{entity_type}` | `{field}` | {who} | {_cell(rule.reason)} |")
    out += ["", "### Read (fields withheld from roles without the right)", "",
            "A withheld field is `null` in every JSON response, and `X-Fields-Withheld` names it.", "",
            "| Field | Readable by |", "|---|---|"]
    for field, roles in sorted(READ_POLICY.items()):
        out.append(f"| `{field}` | {', '.join(sorted(roles))} |")

    readers = _readers()
    settings = _env_settings()
    out += ["", "## 5. Environment settings read by the application", "",
            "Set on the server, outside the application; a change needs a restart. Secrets are named, never shown.", "",
            "| Setting | Area | Default | Read by | Notes |", "|---|---|---|---|---|"]
    for group, name, default, description in settings:
        if not readers[name]:
            continue
        shown = "(secret)" if name in SECRETS else (f"`{default}`" if default else "(empty)")
        used = ", ".join(f"`{Path(r).stem}`" for r in readers[name][:3]) + (" …" if len(readers[name]) > 3 else "")
        out.append(f"| `{name}` | {_cell(group)} | {shown} | {used} | {_cell(description)} |")
    unread = [(g, n, d) for g, n, d, _ in settings if not readers[n]]
    out += ["", "## 6. Environment settings defined but read by nothing", "",
            "These appear in `backend/app/config.py` but no code reads them, so setting them has **no effect**.",
            "They are candidates for removal or for being wired up.", "",
            "| Setting | Area | Default |", "|---|---|---|"]
    for group, name, default in unread:
        out.append(f"| `{name}` | {_cell(group)} | {'(secret)' if name in SECRETS else (f'`{default}`' if default else '(empty)')} |")
    out.append("")
    return "\n".join(out)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    text = render()
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8").replace("\r\n", "\n") if OUTPUT.exists() else ""
        if current != text:
            print(f"{OUTPUT} is out of date; run python -m backend.scripts.generate_parameter_reference")
            return 1
        return 0
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
