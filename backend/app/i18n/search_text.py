"""Matching Nepali (Devanagari) text in searches (RFP TECH B.7).

The same visible word can be stored in different code-point sequences: a nukta letter as one character or
as base letter plus nukta, and invisible zero-width joiners typed by some keyboards. A plain LIKE then misses
it. Both sides of the comparison are normalised the same way: Unicode NFC, zero-width joiners and
non-joiners removed, and Latin letters lower-cased (Devanagari has no case). ``normalised_column`` applies
it inside PostgreSQL, so stored names need no rewriting.

    query = normalise("नेपाल")
    select(Project).where(normalised_column(Project.name_np).like(contains(query), escape="\\\\"))
"""

import unicodedata

from sqlalchemy import func, literal_column
from sqlalchemy.sql.elements import ColumnElement

ZERO_WIDTH = ("‌", "‍")  # zero-width non-joiner, zero-width joiner


def normalise(text: str) -> str:
    composed = unicodedata.normalize("NFC", text or "")
    for mark in ZERO_WIDTH:
        composed = composed.replace(mark, "")
    return composed.strip().lower()


def contains(query: str) -> str:
    """A LIKE pattern for ``query`` anywhere, with the LIKE wildcards in it escaped (use escape='\\\\')."""
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def normalised_column(column) -> ColumnElement:
    """The column normalised as ``normalise`` does, in SQL (needs a UTF8 PostgreSQL database)."""
    expression = func.normalize(func.coalesce(column, ""), literal_column("NFC"))
    for mark in ZERO_WIDTH:
        expression = func.replace(expression, mark, "")
    return func.lower(expression)
