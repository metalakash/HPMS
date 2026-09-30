"""Land governance and ownership management service."""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Dict, Any
import logging

from backend.app.models.operations import (
    LandAcquisitionTracking,
    BoardOfDirectors,
    ShareholdingHierarchy,
)

logger = logging.getLogger(__name__)


class LandGovernanceService:
    """Service for land acquisition and governance tracking."""

    @staticmethod
    async def get_land_governance_data(
        db: AsyncSession,
        project_id: str,
    ) -> Dict[str, Any]:
        """Get land acquisition, BOD, and shareholding data.

        Args:
            db: Database session
            project_id: Project ID

        Returns:
            Dict with land acquisition progress, BOD members, and shareholding
        """
        try:
            # Get land acquisition tracking
            land_stmt = (
                select(LandAcquisitionTracking)
                .where(LandAcquisitionTracking.project_id == project_id)
            )
            land_result = await db.execute(land_stmt)
            land = land_result.scalars().first()

            # Get current BOD members
            bod_stmt = (
                select(BoardOfDirectors)
                .where(BoardOfDirectors.project_id == project_id)
                .where(BoardOfDirectors.is_current == True)
            )
            bod_result = await db.execute(bod_stmt)
            board_members = bod_result.scalars().all()

            # Get current shareholders
            share_stmt = (
                select(ShareholdingHierarchy)
                .where(ShareholdingHierarchy.project_id == project_id)
                .where(ShareholdingHierarchy.is_current == True)
                .order_by(ShareholdingHierarchy.share_pct.desc())
            )
            share_result = await db.execute(share_stmt)
            shareholders = share_result.scalars().all()

            # Format BOD data
            bod_data = []
            for member in board_members:
                bod_data.append({
                    "director_name": member.director_name,
                    "title": member.title,
                    "appointment_date": member.appointment_date_ad.isoformat() if member.appointment_date_ad else None,
                    "appointment_date_bs": member.appointment_date_bs,
                    "seon_reference": member.seon_reference,
                })

            # Format shareholding data
            shareholding_data = []
            total_share = 0
            for shareholder in shareholders:
                share_pct = float(shareholder.share_pct)
                shareholding_data.append({
                    "entity_name": shareholder.entity_name,
                    "entity_type": shareholder.entity_type,
                    "share_pct": share_pct,
                    "effective_from": shareholder.effective_from_ad.isoformat() if shareholder.effective_from_ad else None,
                    "seon_reference": shareholder.seon_reference,
                })
                total_share += share_pct

            return {
                "project_id": project_id,
                "land_acquisition": {
                    "total_area_required_ropani": float(land.total_area_required_ropani) if land and land.total_area_required_ropani else 0,
                    "total_area_acquired_ropani": float(land.total_area_acquired_ropani) if land and land.total_area_acquired_ropani else 0,
                    "acquisition_pct": float(land.acquisition_pct) if land and land.acquisition_pct else 0,
                    "compensation_paid_npr": float(land.compensation_paid_npr) if land and land.compensation_paid_npr else 0,
                    "compensation_outstanding_npr": float(land.compensation_outstanding_npr) if land and land.compensation_outstanding_npr else 0,
                    "last_update": land.last_update_date_ad.isoformat() if land and land.last_update_date_ad else None,
                    "remarks": land.remarks if land else None,
                } if land else {
                    "total_area_required_ropani": 0,
                    "total_area_acquired_ropani": 0,
                    "acquisition_pct": 0,
                    "compensation_paid_npr": 0,
                    "compensation_outstanding_npr": 0,
                },
                "board_of_directors": {
                    "total_members": len(board_members),
                    "members": bod_data,
                },
                "shareholding": {
                    "total_shareholders": len(shareholders),
                    "total_share_pct": round(total_share, 2),
                    "shareholders": shareholding_data,
                },
                "calculation_date": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching land governance data: {e}")
            raise
