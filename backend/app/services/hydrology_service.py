"""Hydrology and water resources service."""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Dict, Any, Optional
import logging

from backend.app.models.operations import HydrologyDetailed
from backend.app.models.project import WaterLicense

logger = logging.getLogger(__name__)


class HydrologyService:
    """Service for hydrology data and water license management."""

    @staticmethod
    async def get_hydrology_data(
        db: AsyncSession,
        project_id: str,
    ) -> Dict[str, Any]:
        """Get hydrology and water license data.

        Args:
            db: Database session
            project_id: Project ID

        Returns:
            Dict with basin info, flow data, and water license status
        """
        try:
            # Get hydrology data
            hydro_stmt = (
                select(HydrologyDetailed)
                .where(HydrologyDetailed.project_id == project_id)
                .order_by(desc(HydrologyDetailed.measurement_date_ad))
                .limit(1)
            )
            hydro_result = await db.execute(hydro_stmt)
            hydro = hydro_result.scalars().first()

            # Get water licenses
            license_stmt = (
                select(WaterLicense)
                .where(WaterLicense.project_id == project_id)
                .where(WaterLicense.status != "expired")
            )
            license_result = await db.execute(license_stmt)
            licenses = license_result.scalars().all()

            # Format licenses with validity status
            license_data = []
            today = datetime.utcnow().date()
            for license in licenses:
                days_until_expiry = (license.validity_to_ad - today).days if license.validity_to_ad else None

                status = "valid"
                if not license.validity_to_ad:
                    status = "valid"
                elif days_until_expiry < 0:
                    status = "expired"
                elif days_until_expiry < 90:
                    status = "expiring_soon"

                license_data.append({
                    "license_number": license.license_number,
                    "issuing_authority": license.issuing_authority,
                    "river_basin": license.river_basin,
                    "validity_from": license.validity_from_ad.isoformat() if license.validity_from_ad else None,
                    "validity_to": license.validity_to_ad.isoformat() if license.validity_to_ad else None,
                    "days_until_expiry": days_until_expiry,
                    "status": status,
                })

            return {
                "project_id": project_id,
                "hydrology": {
                    "river_basin": hydro.river_basin if hydro else None,
                    "sub_basin": hydro.sub_basin if hydro else None,
                    "catchment_area_sqkm": float(hydro.catchment_area_sqkm) if hydro and hydro.catchment_area_sqkm else None,
                    "design_discharge_q90_m3s": float(hydro.design_discharge_m3s) if hydro and hydro.design_discharge_m3s else None,
                    "median_flow_q50_m3s": float(hydro.median_flow_m3s) if hydro and hydro.median_flow_m3s else None,
                    "flow_duration_curve_url": hydro.flow_duration_curve_url if hydro else None,
                    "measurement_date": hydro.measurement_date_ad.isoformat() if hydro and hydro.measurement_date_ad else None,
                    "data_source": hydro.source_reference if hydro else None,
                } if hydro else {},
                "water_licenses": license_data,
                "licenses_expiring_soon": len([l for l in license_data if l["status"] == "expiring_soon"]),
                "calculation_date": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching hydrology data: {e}")
            raise
