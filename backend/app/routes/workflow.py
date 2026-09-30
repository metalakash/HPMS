"""
Workflow API Routes
API endpoints for workflow management and execution
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict

from app.database import get_db
from app.services.workflow import WorkflowService
from app.auth import get_current_user
from app.schemas import WorkflowCreate, WorkflowResponse

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("", response_model=WorkflowResponse)
async def create_workflow(
    workflow_data: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create new workflow"""
    workflow = WorkflowService.create_workflow(
        db,
        name=workflow_data.name,
        steps=workflow_data.steps,
        created_by=current_user["id"],
    )
    return workflow


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetch workflow details"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    updates: Dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update workflow"""
    workflow = WorkflowService.update_workflow(db, workflow_id, updates)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete workflow"""
    WorkflowService.delete_workflow(db, workflow_id)
    return {"success": True}


@router.post("/{workflow_id}/publish", response_model=WorkflowResponse)
async def publish_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Publish workflow to team"""
    workflow = WorkflowService.publish_workflow(db, workflow_id)
    return workflow


@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    trigger_data: Dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Execute workflow with trigger data"""
    try:
        execution = WorkflowService.execute_workflow(db, workflow_id, trigger_data)
        return {
            "execution_id": execution.id,
            "status": execution.status,
            "completed_at": execution.completed_at,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{workflow_id}/test")
async def test_workflow(
    workflow_id: str,
    test_data: Dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Test workflow (dry-run)"""
    try:
        preview = WorkflowService.test_workflow(db, workflow_id, test_data)
        return preview
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/templates")
async def get_templates(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get standard workflow templates"""
    templates = WorkflowService.get_workflow_templates(db)
    return {"templates": templates}


@router.get("")
async def list_workflows(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List user's workflows"""
    workflows = WorkflowService.list_user_workflows(db, current_user["id"])
    return {"workflows": workflows, "count": len(workflows)}
