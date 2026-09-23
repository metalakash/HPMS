"""Risk scoring and assessment (Phase 5 Task 2)."""

import logging
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class RiskScorer:
    """Calculate project-level risk scores."""

    def __init__(self):
        """Initialize risk scorer."""
        self.risk_weights = {
            "compliance": 0.25,
            "operational": 0.25,
            "financial": 0.20,
            "equipment": 0.20,
            "environmental": 0.10,
        }

    def calculate_compliance_risk(
        self,
        covenant_breaches: int = 0,
        alert_count: int = 0,
        compliance_rate: float = 1.0,
    ) -> float:
        """Calculate compliance risk score (0-100).

        Args:
            covenant_breaches: Number of active covenant breaches
            alert_count: Number of unacknowledged compliance alerts
            compliance_rate: Current compliance rate (0-1)

        Returns:
            Risk score 0-100
        """
        try:
            breach_risk = min(50, covenant_breaches * 10)
            alert_risk = min(30, alert_count * 5)
            compliance_risk = max(0, (1.0 - compliance_rate) * 100)

            score = (breach_risk + alert_risk + compliance_risk) / 3
            return min(100, score)

        except Exception as e:
            logger.error(f"Error calculating compliance risk: {e}")
            return 0.0

    def calculate_operational_risk(
        self,
        anomaly_count: int = 0,
        equipment_downtime_pct: float = 0.0,
        forecast_accuracy: float = 0.9,
    ) -> float:
        """Calculate operational risk score (0-100).

        Args:
            anomaly_count: Number of recent anomalies
            equipment_downtime_pct: Percentage of equipment downtime
            forecast_accuracy: Model forecast accuracy (0-1)

        Returns:
            Risk score 0-100
        """
        try:
            anomaly_risk = min(40, anomaly_count * 5)
            downtime_risk = equipment_downtime_pct
            forecast_risk = max(0, (1.0 - forecast_accuracy) * 50)

            score = (anomaly_risk + downtime_risk + forecast_risk) / 3
            return min(100, score)

        except Exception as e:
            logger.error(f"Error calculating operational risk: {e}")
            return 0.0

    def calculate_financial_risk(
        self,
        revenue_variance_pct: float = 0.0,
        capex_overrun_pct: float = 0.0,
        maintenance_backlog_days: int = 0,
    ) -> float:
        """Calculate financial risk score (0-100).

        Args:
            revenue_variance_pct: Variance from projected revenue
            capex_overrun_pct: Capex overrun percentage
            maintenance_backlog_days: Days of deferred maintenance

        Returns:
            Risk score 0-100
        """
        try:
            revenue_risk = abs(revenue_variance_pct)
            capex_risk = min(50, capex_overrun_pct)
            maintenance_risk = min(50, maintenance_backlog_days / 10)

            score = (revenue_risk + capex_risk + maintenance_risk) / 3
            return min(100, score)

        except Exception as e:
            logger.error(f"Error calculating financial risk: {e}")
            return 0.0

    def calculate_equipment_risk(
        self,
        equipment_age_pct: float = 0.0,
        maintenance_overdue_count: int = 0,
        failure_rate: float = 0.0,
    ) -> float:
        """Calculate equipment risk score (0-100).

        Args:
            equipment_age_pct: Equipment age as % of design life
            maintenance_overdue_count: Number of overdue maintenance items
            failure_rate: Equipment failure rate (failures/1000 hours)

        Returns:
            Risk score 0-100
        """
        try:
            age_risk = min(40, equipment_age_pct)
            maintenance_risk = min(40, maintenance_overdue_count * 10)
            failure_risk = min(50, failure_rate * 20)

            score = (age_risk + maintenance_risk + failure_risk) / 3
            return min(100, score)

        except Exception as e:
            logger.error(f"Error calculating equipment risk: {e}")
            return 0.0

    def calculate_environmental_risk(
        self,
        water_availability_trend: float = 0.0,
        regulatory_changes: int = 0,
        environmental_violations: int = 0,
    ) -> float:
        """Calculate environmental risk score (0-100).

        Args:
            water_availability_trend: Water availability trend (-1 to 1)
            regulatory_changes: Number of recent regulatory changes
            environmental_violations: Number of environmental violations

        Returns:
            Risk score 0-100
        """
        try:
            water_risk = max(0, -water_availability_trend * 50) if water_availability_trend < 0 else 0
            regulatory_risk = min(40, regulatory_changes * 15)
            violation_risk = min(50, environmental_violations * 20)

            score = (water_risk + regulatory_risk + violation_risk) / 3
            return min(100, score)

        except Exception as e:
            logger.error(f"Error calculating environmental risk: {e}")
            return 0.0

    def calculate_overall_risk(self, risk_components: Dict[str, float]) -> Dict:
        """Calculate overall project risk score.

        Args:
            risk_components: Dictionary with component risk scores

        Returns:
            Dict with overall risk and breakdown
        """
        try:
            overall_risk = 0.0

            for component, weight in self.risk_weights.items():
                score = risk_components.get(component, 0.0)
                overall_risk += score * weight

            # Determine risk level
            if overall_risk >= 80:
                risk_level = "critical"
            elif overall_risk >= 60:
                risk_level = "high"
            elif overall_risk >= 40:
                risk_level = "medium"
            elif overall_risk >= 20:
                risk_level = "low"
            else:
                risk_level = "minimal"

            return {
                "overall_risk_score": overall_risk,
                "risk_level": risk_level,
                "components": risk_components,
                "timestamp": datetime.utcnow(),
            }

        except Exception as e:
            logger.error(f"Error calculating overall risk: {e}")
            return {
                "overall_risk_score": 0.0,
                "risk_level": "unknown",
                "components": {},
            }

    def get_risk_recommendations(self, risk_score: Dict) -> List[str]:
        """Get recommendations based on risk profile.

        Args:
            risk_score: Risk score output from calculate_overall_risk

        Returns:
            List of risk mitigation recommendations
        """
        recommendations = []
        components = risk_score.get("components", {})

        try:
            # Compliance recommendations
            if components.get("compliance", 0) > 60:
                recommendations.append(
                    "Review and update covenant compliance processes"
                )
                recommendations.append(
                    "Schedule compliance audit with stakeholders"
                )

            # Operational recommendations
            if components.get("operational", 0) > 60:
                recommendations.append(
                    "Investigate equipment anomalies and schedule inspections"
                )
                recommendations.append(
                    "Review predictive maintenance schedule"
                )

            # Financial recommendations
            if components.get("financial", 0) > 60:
                recommendations.append(
                    "Review financial projections and budgets"
                )
                recommendations.append(
                    "Consider hedging strategies for revenue variance"
                )

            # Equipment recommendations
            if components.get("equipment", 0) > 60:
                recommendations.append(
                    "Prioritize critical equipment maintenance"
                )
                recommendations.append(
                    "Develop equipment replacement strategy"
                )

            # Environmental recommendations
            if components.get("environmental", 0) > 60:
                recommendations.append(
                    "Review environmental compliance procedures"
                )
                recommendations.append(
                    "Engage with regulatory authorities"
                )

            return recommendations

        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return []
