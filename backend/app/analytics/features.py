"""Feature engineering for ML models (Phase 5 Task 2)."""

import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger(__name__)


class FeatureEngineering:
    """Extract and engineer features for ML models."""

    # Time-series features
    ROLLING_WINDOWS = [7, 14, 30, 90]  # days
    STATISTICAL_FEATURES = ["mean", "std", "min", "max", "median"]

    @staticmethod
    def extract_features(
        timeseries_data: List[Tuple[datetime, float]],
        lookback_days: int = 90,
    ) -> Dict[str, float]:
        """Extract features from time-series data.

        Args:
            timeseries_data: List of (timestamp, value) tuples
            lookback_days: How many days of history to use

        Returns:
            Dictionary of engineered features
        """
        try:
            if not timeseries_data or len(timeseries_data) < 2:
                return {}

            cutoff_date = datetime.utcnow() - timedelta(days=lookback_days)
            filtered_data = [
                (ts, val) for ts, val in timeseries_data
                if ts >= cutoff_date
            ]

            if len(filtered_data) < 2:
                return {}

            values = [v for _, v in filtered_data]
            features = {}

            # Basic statistics
            features["mean"] = statistics.mean(values)
            features["std_dev"] = statistics.stdev(values) if len(values) > 1 else 0
            features["min"] = min(values)
            features["max"] = max(values)
            features["median"] = statistics.median(values)
            features["range"] = features["max"] - features["min"]
            features["cv"] = (
                features["std_dev"] / features["mean"]
                if features["mean"] != 0 else 0
            )  # Coefficient of variation

            # Trend features
            if len(values) >= 2:
                first_half = values[:len(values) // 2]
                second_half = values[len(values) // 2:]
                features["trend_direction"] = (
                    1 if statistics.mean(second_half) > statistics.mean(first_half)
                    else -1
                )
                features["trend_magnitude"] = (
                    abs(statistics.mean(second_half) - statistics.mean(first_half))
                    / statistics.mean(first_half)
                    if statistics.mean(first_half) != 0 else 0
                )

            # Momentum (recent vs historical)
            if len(values) >= 7:
                recent = values[-7:]
                historical = values[:-7]
                features["momentum"] = (
                    (statistics.mean(recent) - statistics.mean(historical))
                    / statistics.mean(historical)
                    if statistics.mean(historical) != 0 else 0
                )

            # Volatility (rolling)
            features["volatility_7d"] = FeatureEngineering._calculate_volatility(
                values, window=7
            )
            features["volatility_30d"] = FeatureEngineering._calculate_volatility(
                values, window=30
            )

            # Autocorrelation (seasonality indicator)
            if len(values) >= 30:
                features["autocorr_7d"] = FeatureEngineering._calculate_autocorrelation(
                    values, lag=7
                )
                features["autocorr_30d"] = FeatureEngineering._calculate_autocorrelation(
                    values, lag=30
                )

            # Percentiles
            features["p25"] = sorted(values)[len(values) // 4]
            features["p75"] = sorted(values)[3 * len(values) // 4]
            features["iqr"] = features["p75"] - features["p25"]

            logger.debug(f"Extracted {len(features)} features from time-series")
            return features

        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return {}

    @staticmethod
    def _calculate_volatility(values: List[float], window: int = 7) -> float:
        """Calculate rolling volatility (standard deviation).

        Args:
            values: List of values
            window: Rolling window size

        Returns:
            Average rolling volatility
        """
        if len(values) < window:
            return 0

        volatilities = []
        for i in range(len(values) - window + 1):
            window_values = values[i : i + window]
            vol = statistics.stdev(window_values) if len(window_values) > 1 else 0
            volatilities.append(vol)

        return statistics.mean(volatilities) if volatilities else 0

    @staticmethod
    def _calculate_autocorrelation(values: List[float], lag: int = 1) -> float:
        """Calculate autocorrelation at given lag.

        Args:
            values: List of values
            lag: Lag for autocorrelation

        Returns:
            Autocorrelation coefficient (-1 to 1)
        """
        if len(values) <= lag:
            return 0

        mean = statistics.mean(values)
        c0 = sum((x - mean) ** 2 for x in values) / len(values)

        if c0 == 0:
            return 0

        c_lag = sum(
            (values[i] - mean) * (values[i + lag] - mean)
            for i in range(len(values) - lag)
        ) / len(values)

        return c_lag / c0

    @staticmethod
    def extract_seasonal_features(
        timeseries_data: List[Tuple[datetime, float]],
    ) -> Dict[str, float]:
        """Extract seasonal features from time-series.

        Args:
            timeseries_data: List of (timestamp, value) tuples

        Returns:
            Dictionary of seasonal features
        """
        try:
            if not timeseries_data or len(timeseries_data) < 365:
                return {}

            # Group by day-of-year
            by_day_of_year = {}
            for ts, val in timeseries_data:
                doy = ts.timetuple().tm_yday
                if doy not in by_day_of_year:
                    by_day_of_year[doy] = []
                by_day_of_year[doy].append(val)

            features = {}

            # Calculate seasonal patterns
            for doy, values in by_day_of_year.items():
                avg = statistics.mean(values)
                features[f"seasonal_avg_doy{doy}"] = avg

            # Identify peak season
            seasonal_avgs = {
                doy: statistics.mean(vals)
                for doy, vals in by_day_of_year.items()
            }
            peak_doy = max(seasonal_avgs, key=seasonal_avgs.get)
            features["peak_season_doy"] = peak_doy
            features["peak_season_value"] = seasonal_avgs[peak_doy]

            # Identify low season
            low_doy = min(seasonal_avgs, key=seasonal_avgs.get)
            features["low_season_doy"] = low_doy
            features["low_season_value"] = seasonal_avgs[low_doy]

            # Seasonality strength
            all_avgs = list(seasonal_avgs.values())
            features["seasonality_strength"] = (
                (max(all_avgs) - min(all_avgs)) / statistics.mean(all_avgs)
                if statistics.mean(all_avgs) != 0 else 0
            )

            logger.debug(f"Extracted {len(features)} seasonal features")
            return features

        except Exception as e:
            logger.error(f"Error extracting seasonal features: {e}")
            return {}

    @staticmethod
    def extract_external_features(
        weather_data: Optional[Dict] = None,
        equipment_data: Optional[Dict] = None,
        operational_data: Optional[Dict] = None,
    ) -> Dict[str, float]:
        """Extract features from external data sources.

        Args:
            weather_data: Weather parameters (rainfall, temperature, etc)
            equipment_data: Equipment status (age, efficiency, maintenance history)
            operational_data: Operational metrics (demand, consumption, losses)

        Returns:
            Dictionary of external features
        """
        features = {}

        try:
            # Weather features
            if weather_data:
                if "rainfall" in weather_data:
                    features["rainfall_mm"] = weather_data["rainfall"]
                if "temperature" in weather_data:
                    features["temperature_c"] = weather_data["temperature"]
                if "humidity" in weather_data:
                    features["humidity_pct"] = weather_data["humidity"]
                if "wind_speed" in weather_data:
                    features["wind_speed_kmh"] = weather_data["wind_speed"]

            # Equipment features
            if equipment_data:
                if "age_days" in equipment_data:
                    features["equipment_age_days"] = equipment_data["age_days"]
                if "efficiency_pct" in equipment_data:
                    features["equipment_efficiency"] = equipment_data["efficiency_pct"]
                if "maintenance_due" in equipment_data:
                    features["maintenance_due_days"] = equipment_data["maintenance_due"]
                if "mtbf_hours" in equipment_data:
                    features["mtbf_hours"] = equipment_data["mtbf_hours"]

            # Operational features
            if operational_data:
                if "demand_mw" in operational_data:
                    features["demand_mw"] = operational_data["demand_mw"]
                if "reserve_pct" in operational_data:
                    features["reserve_pct"] = operational_data["reserve_pct"]
                if "transmission_loss_pct" in operational_data:
                    features["transmission_loss_pct"] = operational_data[
                        "transmission_loss_pct"
                    ]

            logger.debug(f"Extracted {len(features)} external features")
            return features

        except Exception as e:
            logger.error(f"Error extracting external features: {e}")
            return {}

    @staticmethod
    def normalize_features(
        features: Dict[str, float],
        feature_stats: Optional[Dict[str, Dict[str, float]]] = None,
    ) -> Dict[str, float]:
        """Normalize features to 0-1 range.

        Args:
            features: Raw features dictionary
            feature_stats: Pre-computed min/max for each feature

        Returns:
            Normalized features dictionary
        """
        normalized = {}

        try:
            for key, value in features.items():
                if feature_stats and key in feature_stats:
                    stats = feature_stats[key]
                    min_val = stats.get("min", 0)
                    max_val = stats.get("max", 1)

                    if max_val != min_val:
                        normalized[key] = (value - min_val) / (max_val - min_val)
                    else:
                        normalized[key] = 0
                else:
                    # Default: assume 0-100 range
                    normalized[key] = max(0, min(1, value / 100))

            return normalized

        except Exception as e:
            logger.error(f"Error normalizing features: {e}")
            return features
