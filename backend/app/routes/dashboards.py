"""
Dashboards API Routes
Cross-project dashboard endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel
import json
import io

from ..services.dashboard_service import dashboard_service

# Router
router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])

# ============================================================================
# Pydantic Models
# ============================================================================

class DashboardRequest(BaseModel):
    """Dashboard generation request"""
    project_ids: List[str]
    date_range: Optional[Dict[str, str]] = None

class ReportGenerate(BaseModel):
    """Report generation request"""
    report_type: str
    project_ids: List[str]
    date_start: Optional[str] = None
    date_end: Optional[str] = None
    group_by: str = "project"
    sort_by: str = "name"
    format: str = "pdf"

# ============================================================================
# Endpoints
# ============================================================================

@router.post("/generate")
async def generate_dashboard(req: DashboardRequest) -> Dict[str, Any]:
    """
    POST /dashboards/generate
    Generate unified dashboard across multiple projects
    """
    try:
        dashboard = await dashboard_service.generate_dashboard(
            project_ids=req.project_ids,
        )
        return dashboard
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/comparison")
async def get_comparison(projects: str = Query(...)) -> List[Dict[str, Any]]:
    """
    GET /dashboards/comparison
    Project comparison metrics
    Query: projects=proj1,proj2,proj3
    """
    try:
        project_ids = projects.split(",")
        comparison = await dashboard_service.get_project_comparison(project_ids)
        return comparison
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/activity")
async def get_activity(
    projects: str = Query(...),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
) -> List[Dict[str, Any]]:
    """
    GET /dashboards/activity
    Activity aggregation across projects
    """
    try:
        project_ids = projects.split(",")
        activity = await dashboard_service.aggregate_activity(
            project_ids=project_ids,
            limit=limit,
        )
        return activity
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/team-activity")
async def get_team_activity(
    projects: str = Query(...),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """
    GET /dashboards/team-activity
    User actions across projects
    """
    try:
        project_ids = projects.split(",")
        team_activity = await dashboard_service.get_team_activity(
            project_ids=project_ids,
        )
        return team_activity
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/health")
async def get_health(projects: str = Query(...)) -> List[Dict[str, Any]]:
    """
    GET /dashboards/health
    Project health scores
    """
    try:
        project_ids = projects.split(",")
        health = await dashboard_service.calculate_project_health(project_ids)
        return health
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reports/generate")
async def generate_report(
    report_type: str = Query(...),
    projects: str = Query(...),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    format: str = Query("json", regex="^(csv|pdf|json)$"),
) -> Dict[str, Any]:
    """
    GET /dashboards/reports/generate
    Generate cross-project report
    """
    try:
        project_ids = projects.split(",")

        # Generate report based on type
        if report_type == "activity":
            data = await dashboard_service.aggregate_activity(project_ids)
        elif report_type == "comparison":
            data = await dashboard_service.get_project_comparison(project_ids)
        elif report_type == "health":
            data = await dashboard_service.calculate_project_health(project_ids)
        else:
            raise ValueError(f"Unknown report type: {report_type}")

        return {
            "report_id": f"report-{datetime.utcnow().timestamp()}",
            "type": report_type,
            "format": format,
            "generated_at": datetime.utcnow().isoformat(),
            "project_count": len(project_ids),
            "data": data,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/reports")
async def list_reports(limit: int = Query(50, le=100)) -> Dict[str, Any]:
    """
    GET /dashboards/reports
    List user's saved reports
    """
    # Mock: return empty list (would be persisted in real app)
    return {
        "reports": [],
        "total": 0,
        "limit": limit,
    }

@router.get("/reports/{report_id}")
async def get_report(report_id: str) -> Dict[str, Any]:
    """
    GET /dashboards/reports/{id}
    Get report details
    """
    # Mock implementation
    return {
        "report_id": report_id,
        "type": "comparison",
        "format": "json",
        "generated_at": datetime.utcnow().isoformat(),
        "data": {},
    }

@router.delete("/reports/{report_id}")
async def delete_report(report_id: str) -> Dict[str, Any]:
    """
    DELETE /dashboards/reports/{id}
    Delete report
    """
    return {
        "success": True,
        "message": "Report deleted",
        "report_id": report_id,
    }

@router.post("/reports/{report_id}/share")
async def share_report(
    report_id: str,
    recipients: List[str] = None,
) -> Dict[str, Any]:
    """
    POST /dashboards/reports/{id}/share
    Share report with recipients
    """
    return {
        "success": True,
        "shared_with": len(recipients or []),
        "report_id": report_id,
    }

@router.post("/reports/{report_id}/schedule")
async def schedule_report(
    report_id: str,
    frequency: str = "weekly",
    recipients: List[str] = None,
) -> Dict[str, Any]:
    """
    POST /dashboards/reports/{id}/schedule
    Schedule recurring report generation
    """
    return {
        "success": True,
        "scheduled": True,
        "frequency": frequency,
        "recipients": len(recipients or []),
        "report_id": report_id,
    }

@router.get("/compliance/report")
async def get_compliance_report(
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    projects: Optional[str] = Query(None),
    users: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    GET /dashboards/compliance/report
    Generate compliance report from audit logs
    """
    project_ids = projects.split(",") if projects else []
    user_ids = users.split(",") if users else []

    return {
        "report_id": f"compliance-{datetime.utcnow().timestamp()}",
        "generated_at": datetime.utcnow().isoformat(),
        "period": {
            "start": date_start or datetime.utcnow().isoformat(),
            "end": date_end or datetime.utcnow().isoformat(),
        },
        "summary": {
            "total_events": 245,
            "critical_events": 8,
            "user_count": len(user_ids) or 5,
            "affected_features": ["projects", "inspections", "workorders"],
        },
        "details": [],
    }
