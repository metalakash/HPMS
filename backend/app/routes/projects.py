"""
Projects API Routes
Project management endpoints
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from ..services.project_service import project_service, ProjectStatus
from ..services.dashboard_service import dashboard_service

# Router
router = APIRouter(prefix="/api/projects", tags=["projects"])

# ============================================================================
# Pydantic Models
# ============================================================================

class ProjectCreate(BaseModel):
    """Create project request"""
    name: str
    description: str
    members: Optional[List[Dict[str, Any]]] = None

class ProjectUpdate(BaseModel):
    """Update project request"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class MemberAdd(BaseModel):
    """Add member request"""
    email: str
    role: str = "member"

class ProjectResponse(BaseModel):
    """Project response model"""
    id: str
    name: str
    description: str
    owner_id: str
    owner_email: str
    status: str
    members: List[Dict[str, Any]]
    created_at: str
    updated_at: str

# ============================================================================
# Endpoints
# ============================================================================

@router.get("")
async def list_projects(limit: int = Query(50, le=100)) -> Dict[str, Any]:
    """
    GET /projects
    List user's projects
    """
    # In real app, would filter by current user
    user_id = "user-1"  # Mock current user
    projects = await project_service.list_user_projects(user_id)
    return {
        "projects": [p.to_dict() for p in projects[:limit]],
        "total": len(projects),
        "limit": limit,
    }

@router.post("")
async def create_project(req: ProjectCreate) -> ProjectResponse:
    """
    POST /projects
    Create new project
    """
    user_id = "user-1"  # Mock current user
    user_email = "akash@example.com"  # Mock current user email

    project = await project_service.create_project(
        name=req.name,
        description=req.description,
        owner_id=user_id,
        owner_email=user_email,
        members=req.members,
    )
    return project.to_dict()

@router.get("/{project_id}")
async def get_project(project_id: str) -> ProjectResponse:
    """
    GET /projects/{id}
    Get project details
    """
    try:
        project = await project_service.get_project(project_id)
        return project.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{project_id}")
async def update_project(
    project_id: str,
    req: ProjectUpdate,
) -> ProjectResponse:
    """
    PUT /projects/{id}
    Update project details (owner only)
    """
    try:
        status = ProjectStatus(req.status) if req.status else None
        project = await project_service.update_project(
            project_id=project_id,
            name=req.name,
            description=req.description,
            status=status,
        )
        return project.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{project_id}")
async def delete_project(project_id: str) -> Dict[str, Any]:
    """
    DELETE /projects/{id}
    Delete project (owner only)
    """
    try:
        await project_service.delete_project(project_id)
        return {"success": True, "message": "Project deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{project_id}/members")
async def list_members(project_id: str) -> List[Dict[str, Any]]:
    """
    GET /projects/{id}/members
    List project members
    """
    try:
        project = await project_service.get_project(project_id)
        return project.members
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{project_id}/members")
async def add_member(
    project_id: str,
    req: MemberAdd,
) -> Dict[str, Any]:
    """
    POST /projects/{id}/members
    Add team member
    """
    try:
        member = await project_service.add_member(
            project_id=project_id,
            email=req.email,
            role=req.role,
        )
        return member
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{project_id}/members/{user_id}")
async def remove_member(project_id: str, user_id: str) -> Dict[str, Any]:
    """
    DELETE /projects/{id}/members/{user_id}
    Remove team member (owner only)
    """
    try:
        success = await project_service.remove_member(project_id, user_id)
        return {"success": success, "message": "Member removed"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{project_id}/members/{user_id}")
async def update_member_role(
    project_id: str,
    user_id: str,
    role: str = Body(..., embed=True),
) -> Dict[str, Any]:
    """
    PATCH /projects/{id}/members/{user_id}
    Change member role (owner only)
    """
    try:
        member = await project_service.update_member_role(
            project_id=project_id,
            user_id=user_id,
            role=role,
        )
        return member
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{project_id}/stats")
async def get_stats(project_id: str) -> Dict[str, Any]:
    """
    GET /projects/{id}/stats
    Get project statistics
    """
    try:
        stats = await project_service.get_project_stats(project_id)
        return stats
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{project_id}/health")
async def get_health(project_id: str) -> Dict[str, Any]:
    """
    GET /projects/{id}/health
    Get project health score
    """
    try:
        health = await project_service.get_project_health(project_id)
        return health
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{project_id}/activity")
async def get_activity(
    project_id: str,
    limit: int = Query(50, le=100),
) -> List[Dict[str, Any]]:
    """
    GET /projects/{id}/activity
    Get recent project activity
    """
    try:
        activity = await project_service.get_project_activity(project_id, limit)
        return activity
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{project_id}/share")
async def share_project(
    project_id: str,
    recipients: List[str] = Body(..., embed=True),
) -> Dict[str, Any]:
    """
    POST /projects/{id}/share
    Share project with recipients
    """
    try:
        result = await project_service.share_project(project_id, recipients)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/shared")
async def list_shared_projects() -> Dict[str, Any]:
    """
    GET /projects/shared
    List projects shared with current user
    """
    user_id = "user-1"  # Mock current user
    projects = await project_service.list_shared_projects(user_id)
    return {
        "projects": [p.to_dict() for p in projects],
        "total": len(projects),
    }

@router.get("/current")
async def get_current_project() -> Dict[str, Any]:
    """
    GET /projects/current
    Get currently active project
    """
    project = await project_service.get_current_project()
    if not project:
        raise HTTPException(status_code=404, detail="No active project")
    return project.to_dict()

@router.post("/{project_id}/switch")
async def switch_project(project_id: str) -> ProjectResponse:
    """
    POST /projects/{id}/switch
    Switch to different project
    """
    try:
        project = await project_service.switch_project(project_id)
        return project.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{project_id}/export")
async def export_project(
    project_id: str,
    format: str = Query("json", regex="^(json|csv)$"),
) -> Dict[str, Any]:
    """
    GET /projects/{id}/export
    Export project data
    """
    try:
        project = await project_service.get_project(project_id)
        return {
            "format": format,
            "exported_at": datetime.utcnow().isoformat(),
            "project": project.to_dict(),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
