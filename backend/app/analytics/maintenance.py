"""Maintenance prediction (Phase 5 Task 2)."""

import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class MaintenancePredictor:
    """Predict equipment maintenance needs."""

    def __init__(self):
        """Initialize maintenance predictor."""
        self.equipment_history: Dict = {}

    def train(
        self,
        equipment_id: str,
        maintenance_intervals: List[Dict],
    ) -> bool:
        """Train predictor with maintenance history.

        Args:
            equipment_id: Equipment identifier
            maintenance_intervals: List of maintenance events with intervals

        Returns:
            True if training successful
        """
        try:
            if not maintenance_intervals or len(maintenance_intervals) < 3:
                logger.warning(f"Insufficient maintenance history for {equipment_id}")
                return False

            # Calculate average intervals
            intervals = []
            for i in range(1, len(maintenance_intervals)):
                prev_date = maintenance_intervals[i-1]["date"]
                curr_date = maintenance_intervals[i]["date"]
                interval = (curr_date - prev_date).days
                intervals.append(interval)

            if not intervals:
                return False

            avg_interval = sum(intervals) / len(intervals)

            self.equipment_history[equipment_id] = {
                "maintenance_events": maintenance_intervals,
                "avg_interval_days": avg_interval,
                "std_interval_days": self._calculate_std(intervals),
                "last_maintenance": maintenance_intervals[-1]["date"],
                "trained": True,
            }

            logger.info(
                f"Maintenance predictor trained for {equipment_id}: "
                f"avg interval {avg_interval:.0f} days"
            )
            return True

        except Exception as e:
            logger.error(f"Error training maintenance predictor: {e}")
            return False

    def predict_maintenance_date(
        self, equipment_id: str
    ) -> Optional[Dict]:
        """Predict next maintenance date for equipment.

        Args:
            equipment_id: Equipment identifier

        Returns:
            Dict with predicted date and confidence, or None
        """
        try:
            if equipment_id not in self.equipment_history:
                logger.warning(f"No history for equipment: {equipment_id}")
                return None

            history = self.equipment_history[equipment_id]
            if not history.get("trained"):
                return None

            last_maintenance = history["last_maintenance"]
            avg_interval = history["avg_interval_days"]
            std_interval = history["std_interval_days"]

            predicted_date = last_maintenance + timedelta(days=avg_interval)
            days_until = (predicted_date - datetime.utcnow()).days

            # Calculate confidence (more consistent intervals = higher confidence)
            consistency = 1.0 - min(1.0, std_interval / avg_interval)

            return {
                "equipment_id": equipment_id,
                "predicted_date": predicted_date,
                "days_until": days_until,
                "avg_interval_days": avg_interval,
                "confidence": consistency,
                "urgency": self._calculate_urgency(days_until),
                "last_maintenance": last_maintenance,
            }

        except Exception as e:
            logger.error(f"Error predicting maintenance: {e}")
            return None

    def predict_maintenance_batch(
        self, equipment_ids: List[str]
    ) -> List[Dict]:
        """Predict maintenance for multiple equipment.

        Args:
            equipment_ids: List of equipment IDs

        Returns:
            List of maintenance predictions
        """
        predictions = []

        for equipment_id in equipment_ids:
            prediction = self.predict_maintenance_date(equipment_id)
            if prediction:
                predictions.append(prediction)

        return sorted(
            predictions,
            key=lambda x: x["predicted_date"]
        )

    def _calculate_urgency(self, days_until: int) -> str:
        """Calculate maintenance urgency.

        Args:
            days_until: Days until predicted maintenance

        Returns:
            Urgency level
        """
        if days_until < 0:
            return "overdue"
        elif days_until < 7:
            return "urgent"
        elif days_until < 30:
            return "soon"
        else:
            return "scheduled"

    def _calculate_std(self, values: List[float]) -> float:
        """Calculate standard deviation.

        Args:
            values: List of values

        Returns:
            Standard deviation
        """
        if len(values) < 2:
            return 0

        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        return variance ** 0.5

    def record_maintenance(
        self,
        equipment_id: str,
        maintenance_date: datetime,
        work_type: str = "scheduled",
        notes: str = "",
    ) -> bool:
        """Record completed maintenance.

        Args:
            equipment_id: Equipment ID
            maintenance_date: When maintenance was performed
            work_type: Type of work (scheduled, emergency, inspection, repair)
            notes: Work notes

        Returns:
            True if recorded successfully
        """
        try:
            if equipment_id not in self.equipment_history:
                self.equipment_history[equipment_id] = {
                    "maintenance_events": [],
                    "trained": False,
                }

            self.equipment_history[equipment_id]["maintenance_events"].append({
                "date": maintenance_date,
                "work_type": work_type,
                "notes": notes,
            })

            logger.info(
                f"Recorded {work_type} maintenance for {equipment_id} on {maintenance_date}"
            )
            return True

        except Exception as e:
            logger.error(f"Error recording maintenance: {e}")
            return False

    def get_maintenance_schedule(
        self, days_ahead: int = 30
    ) -> List[Dict]:
        """Get predicted maintenance schedule for upcoming days.

        Args:
            days_ahead: Days to look ahead

        Returns:
            List of scheduled maintenance
        """
        schedule = []
        cutoff = datetime.utcnow() + timedelta(days=days_ahead)

        for equipment_id in self.equipment_history:
            prediction = self.predict_maintenance_date(equipment_id)
            if prediction and prediction["predicted_date"] <= cutoff:
                schedule.append(prediction)

        return sorted(
            schedule,
            key=lambda x: x["predicted_date"]
        )
