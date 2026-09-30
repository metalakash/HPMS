"""
Cross-Feature API Routes
API endpoints for cross-feature linking and dependency management
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.cross_feature import CrossFeatureService
from app.auth import get_current_user
from app.schemas import FeatureLinkCreate, FeatureLinkResponse

router = APIRouter(prefix="/links", tags=["cross-feature"])


@router.post("", response_model=FeatureLinkResponse)
async def create_link(
    link_data: FeatureLinkCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create new cross-feature link"""
    try:
        link = CrossFeatureService.create_link(
            db,
            from_id=link_data.from_id,
            to_id=link_data.to_id,
            from_feature=link_data.from_feature,
            to_feature=link_data.to_feature,
            strength=link_data.strength,
            created_by=current_user["id"],
        )
        return link
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{record_id}")
async def get_links(
    record_id: str,
    feature: str = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetch all links for a record"""
    links = CrossFeatureService.get_links(db, record_id, feature)
    return {"links": links, "count": len(links)}


@router.delete("/{link_id}")
async def delete_link(
    link_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a link"""
    CrossFeatureService.remove_link(db, link_id)
    return {"success": True}


@router.put("/{link_id}/strength")
async def update_strength(
    link_id: str,
    strength: str = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Modify link strength"""
    link = CrossFeatureService.update_link_strength(db, link_id, strength)
    return link


@router.get("/map")
async def get_map(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get feature network for visualization"""
    return CrossFeatureService.get_feature_map(db)


@router.get("/dependencies")
async def get_dependencies(
    status: str = Query(None),
    blocked_by_count_gt: int = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetch dependencies with optional filtering"""
    blocking_issues = CrossFeatureService.identify_blocking_issues(db)
    return {"dependencies": blocking_issues}


@router.get("/critical-path")
async def get_critical_path(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get longest dependency chain"""
    path = CrossFeatureService.get_critical_path(db)
    return {"critical_path": path}


@router.get("/blocking-issues")
async def get_blocking_issues(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Find items blocking others"""
    issues = CrossFeatureService.identify_blocking_issues(db)
    return {"blocking_issues": issues}


@router.get("/health")
async def get_health(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get dependency health score"""
    health = CrossFeatureService.calculate_dependency_health(db)
    return health


@router.post("/validate-link")
async def validate_link(
    from_id: str = Query(...),
    to_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Validate if link would create circular dependency"""
    is_circular = CrossFeatureService.find_circular_dependency(db, from_id, to_id)
    return {"valid": not is_circular, "error": "Circular dependency detected" if is_circular else None}
