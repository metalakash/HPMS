"""Risk register helpers (RFP E.9, E.19, E.20)."""

SEVERITY_BANDS = ((20, "critical"), (12, "high"), (6, "medium"), (1, "low"))


def compute_severity(likelihood: int, impact: int) -> str:
    """Map a 1-5 likelihood x 1-5 impact score to a severity band."""
    if not (1 <= likelihood <= 5 and 1 <= impact <= 5):
        raise ValueError("likelihood and impact must be between 1 and 5")
    score = likelihood * impact
    for threshold, label in SEVERITY_BANDS:
        if score >= threshold:
            return label
    return "low"
