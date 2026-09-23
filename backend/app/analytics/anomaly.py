"""Anomaly detection for equipment monitoring (Phase 5 Task 2)."""

import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Detect anomalies in equipment data indicating failures."""

    def __init__(self, sensitivity: float = 2.0):
        """Initialize anomaly detector.

        Args:
            sensitivity: Sensitivity threshold (std devs from mean)
        """
        self.sensitivity = sensitivity
        self.baseline_stats: Dict = {}
        self.anomalies: List[Dict] = []

    def train(self, timeseries_data: List[Tuple[datetime, float]]) -> bool:
        """Train anomaly detector with normal data.

        Args:
            timeseries_data: List of (timestamp, value) tuples

        Returns:
            True if training successful
        """
        try:
            if not timeseries_data or len(timeseries_data) < 30:
                logger.warning("Insufficient data for anomaly detection training")
                return False

            values = [v for _, v in timeseries_data]

            self.baseline_stats = {
                "mean": statistics.mean(values),
                "std": statistics.stdev(values) if len(values) > 1 else 0,
                "min": min(values),
                "max": max(values),
                "count": len(values),
            }

            logger.info(f"Anomaly detector trained with {len(values)} samples")
            return True

        except Exception as e:
            logger.error(f"Error training anomaly detector: {e}")
            return False

    def detect(self, value: float, timestamp: datetime = None) -> Optional[Dict]:
        """Detect if value is anomalous.

        Args:
            value: Current value
            timestamp: When value occurred

        Returns:
            Anomaly dict or None if normal
        """
        try:
            if not self.baseline_stats:
                return None

            mean = self.baseline_stats["mean"]
            std = self.baseline_stats["std"]

            # If std is 0, use a small value to detect large deviations
            if std == 0:
                # If value differs significantly from mean, it's anomalous
                if abs(value - mean) > mean * 0.5:  # >50% deviation
                    z_score = 5.0  # Treat as critical anomaly
                else:
                    return None
            else:
                # Calculate z-score
                z_score = abs((value - mean) / std)

            threshold = self.sensitivity

            if z_score > threshold:
                anomaly = {
                    "timestamp": timestamp or datetime.utcnow(),
                    "value": value,
                    "z_score": z_score,
                    "severity": self._calculate_severity(z_score),
                    "expected_range": (mean - 2 * std, mean + 2 * std),
                    "baseline_mean": mean,
                }

                self.anomalies.append(anomaly)

                logger.warning(
                    f"Anomaly detected: z_score={z_score:.2f}, "
                    f"value={value:.2f}, expected mean={mean:.2f}"
                )
                return anomaly

            return None

        except Exception as e:
            logger.error(f"Error detecting anomaly: {e}")
            return None

    def detect_trend_anomaly(
        self, recent_values: List[float], window: int = 7
    ) -> Optional[Dict]:
        """Detect anomalous trends (rapid degradation, instability).

        Args:
            recent_values: Recent data points
            window: Trend window size

        Returns:
            Anomaly dict or None if normal trend
        """
        try:
            if len(recent_values) < window:
                return None

            recent_window = recent_values[-window:]
            older_window = recent_values[-2*window:-window] if len(recent_values) >= 2*window else recent_window

            recent_mean = statistics.mean(recent_window)
            older_mean = statistics.mean(older_window)

            if older_mean == 0:
                return None

            # Check for rapid degradation
            degradation_rate = abs(recent_mean - older_mean) / older_mean

            if degradation_rate > 0.3:  # >30% change
                return {
                    "timestamp": datetime.utcnow(),
                    "type": "trend_anomaly",
                    "degradation_rate": degradation_rate,
                    "severity": "high" if degradation_rate > 0.5 else "medium",
                    "recent_mean": recent_mean,
                    "older_mean": older_mean,
                }

            return None

        except Exception as e:
            logger.error(f"Error detecting trend anomaly: {e}")
            return None

    def _calculate_severity(self, z_score: float) -> str:
        """Calculate anomaly severity based on z-score.

        Args:
            z_score: Standardized anomaly score

        Returns:
            Severity level (low, medium, high, critical)
        """
        if z_score > 4.0:
            return "critical"
        elif z_score > 3.0:
            return "high"
        elif z_score > 2.5:
            return "medium"
        else:
            return "low"

    def get_anomaly_rate(self, hours: int = 24) -> float:
        """Get rate of anomalies detected recently.

        Args:
            hours: Time window

        Returns:
            Anomalies per hour
        """
        try:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            recent = [
                a for a in self.anomalies
                if a["timestamp"] >= cutoff
            ]

            return len(recent) / max(1, hours)

        except Exception as e:
            logger.error(f"Error calculating anomaly rate: {e}")
            return 0.0

    def get_recent_anomalies(self, limit: int = 10) -> List[Dict]:
        """Get most recent anomalies.

        Args:
            limit: Maximum anomalies to return

        Returns:
            List of recent anomalies
        """
        return sorted(
            self.anomalies,
            key=lambda x: x["timestamp"],
            reverse=True
        )[:limit]
