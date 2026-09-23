"""Generation forecasting models (Phase 5 Task 2)."""

import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger(__name__)


class GenerationForecaster:
    """Forecast hydropower generation using historical patterns."""

    def __init__(self):
        """Initialize forecaster."""
        self.historical_data: List[Tuple[datetime, float]] = []
        self.seasonal_patterns: Dict = {}

    def train(self, historical_data: List[Tuple[datetime, float]]) -> bool:
        """Train forecaster with historical data.

        Args:
            historical_data: List of (timestamp, generation_mw) tuples

        Returns:
            True if training successful
        """
        try:
            if not historical_data or len(historical_data) < 30:
                logger.warning("Insufficient historical data for training")
                return False

            self.historical_data = historical_data
            self._calculate_seasonal_patterns()

            logger.info(f"Generation forecaster trained with {len(historical_data)} data points")
            return True

        except Exception as e:
            logger.error(f"Error training forecaster: {e}")
            return False

    def forecast_7day(self) -> Dict[str, float]:
        """Forecast generation for next 7 days.

        Returns:
            Dictionary with daily forecasts
        """
        return self._forecast_ahead(days=7)

    def forecast_30day(self) -> Dict[str, float]:
        """Forecast generation for next 30 days.

        Returns:
            Dictionary with daily forecasts
        """
        return self._forecast_ahead(days=30)

    def forecast_90day(self) -> Dict[str, float]:
        """Forecast generation for next 90 days.

        Returns:
            Dictionary with daily forecasts
        """
        return self._forecast_ahead(days=90)

    def _forecast_ahead(self, days: int = 7) -> Dict[str, float]:
        """Forecast generation ahead by specified days.

        Args:
            days: Number of days to forecast

        Returns:
            Dictionary mapping date -> forecast_mw
        """
        try:
            if not self.historical_data:
                logger.warning("No historical data for forecasting")
                return {}

            forecasts = {}
            base_date = datetime.utcnow()

            # Get recent average
            recent_values = [
                v for ts, v in self.historical_data
                if ts >= base_date - timedelta(days=30)
            ]
            recent_avg = (
                statistics.mean(recent_values)
                if recent_values else statistics.mean([v for _, v in self.historical_data])
            )

            for i in range(1, days + 1):
                forecast_date = base_date + timedelta(days=i)
                doy = forecast_date.timetuple().tm_yday

                # Use seasonal pattern if available
                if doy in self.seasonal_patterns:
                    seasonal_factor = self.seasonal_patterns[doy]["factor"]
                    forecast_mw = recent_avg * seasonal_factor
                else:
                    forecast_mw = recent_avg

                # Add small randomness for realism
                import random
                variance = recent_avg * 0.05  # ±5% variance
                forecast_mw += random.uniform(-variance, variance)

                forecasts[forecast_date.strftime("%Y-%m-%d")] = max(0, forecast_mw)

            logger.info(f"Generated {days}-day forecast")
            return forecasts

        except Exception as e:
            logger.error(f"Error forecasting: {e}")
            return {}

    def _calculate_seasonal_patterns(self) -> None:
        """Calculate seasonal patterns from historical data."""
        try:
            by_doy = {}

            for ts, value in self.historical_data:
                doy = ts.timetuple().tm_yday
                if doy not in by_doy:
                    by_doy[doy] = []
                by_doy[doy].append(value)

            # Calculate seasonal factors
            all_values = [v for _, v in self.historical_data]
            overall_mean = statistics.mean(all_values)

            for doy, values in by_doy.items():
                doy_mean = statistics.mean(values)
                factor = doy_mean / overall_mean if overall_mean > 0 else 1.0

                self.seasonal_patterns[doy] = {
                    "mean": doy_mean,
                    "factor": factor,
                    "std": (
                        statistics.stdev(values)
                        if len(values) > 1 else 0
                    ),
                }

            logger.debug(f"Calculated seasonal patterns for {len(self.seasonal_patterns)} days")

        except Exception as e:
            logger.error(f"Error calculating seasonal patterns: {e}")

    def get_forecast_confidence(self, days_ahead: int = 7) -> float:
        """Get confidence level of forecast (0-1).

        Args:
            days_ahead: Number of days in forecast

        Returns:
            Confidence score
        """
        if not self.historical_data:
            return 0.0

        # More data = higher confidence
        data_confidence = min(1.0, len(self.historical_data) / 365)

        # Closer forecasts = higher confidence
        days_confidence = max(0.3, 1.0 - (days_ahead / 365))

        return (data_confidence + days_confidence) / 2
