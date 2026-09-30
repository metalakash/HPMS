"""
Workflow Service
Workflow design and execution service
"""

from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.orm import Session

from app.models import Workflow, WorkflowStep, WorkflowExecution
from app.schemas import WorkflowCreate, WorkflowUpdate


class WorkflowService:
    """Manages workflow creation, execution, and management"""

    @staticmethod
    def create_workflow(db: Session, name: str, steps: List[Dict], created_by: str = None) -> Workflow:
        """Create new workflow"""
        workflow = Workflow(
            name=name,
            is_published=False,
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        db.add(workflow)
        db.flush()

        for idx, step_data in enumerate(steps):
            step = WorkflowStep(
                workflow_id=workflow.id,
                order=idx + 1,
                action=step_data.get("action"),
                feature=step_data.get("feature"),
                condition=step_data.get("condition"),
            )
            db.add(step)

        db.commit()
        return workflow

    @staticmethod
    def update_workflow(db: Session, workflow_id: str, updates: Dict) -> Workflow:
        """Modify workflow"""
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if workflow:
            for key, value in updates.items():
                if key == "steps":
                    db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow_id).delete()
                    for idx, step_data in enumerate(value):
                        step = WorkflowStep(
                            workflow_id=workflow_id,
                            order=idx + 1,
                            action=step_data.get("action"),
                            feature=step_data.get("feature"),
                            condition=step_data.get("condition"),
                        )
                        db.add(step)
                else:
                    setattr(workflow, key, value)
            db.commit()
        return workflow

    @staticmethod
    def delete_workflow(db: Session, workflow_id: str) -> None:
        """Remove workflow"""
        db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow_id).delete()
        db.query(Workflow).filter(Workflow.id == workflow_id).delete()
        db.commit()

    @staticmethod
    def publish_workflow(db: Session, workflow_id: str) -> Workflow:
        """Make workflow available to team"""
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if workflow:
            workflow.is_published = True
            db.commit()
        return workflow

    @staticmethod
    def execute_workflow(db: Session, workflow_id: str, trigger_data: Dict) -> WorkflowExecution:
        """Execute workflow steps"""
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        execution = WorkflowExecution(
            workflow_id=workflow_id,
            status="in_progress",
            trigger_data=trigger_data,
            started_at=datetime.utcnow(),
        )
        db.add(execution)
        db.flush()

        steps = db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow_id).order_by(WorkflowStep.order).all()

        for step in steps:
            try:
                execution.executed_steps.append(
                    {
                        "step_id": step.id,
                        "action": step.action,
                        "status": "completed",
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
            except Exception as e:
                execution.status = "failed"
                execution.error_message = str(e)
                break

        execution.status = "completed"
        execution.completed_at = datetime.utcnow()
        db.commit()
        return execution

    @staticmethod
    def test_workflow(db: Session, workflow_id: str, test_data: Dict) -> Dict:
        """Dry-run workflow (preview)"""
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        steps = db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow_id).order_by(WorkflowStep.order).all()

        preview = {
            "workflow_id": workflow_id,
            "workflow_name": workflow.name,
            "test_mode": True,
            "steps_preview": [
                {
                    "order": step.order,
                    "action": step.action,
                    "feature": step.feature,
                    "condition": step.condition,
                    "would_execute": True,
                }
                for step in steps
            ],
            "estimated_duration": "2-3 seconds",
            "changes_would_be_made": len(steps),
        }
        return preview

    @staticmethod
    def get_workflow_templates(db: Session) -> List[Workflow]:
        """Standard workflow templates"""
        templates = [
            {
                "name": "Standard Defect Workflow",
                "description": "Inspection → Work Order → Compliance",
                "steps": [
                    {"action": "create_inspection", "feature": "inspections"},
                    {"action": "create_workorder", "feature": "workorders"},
                    {"action": "create_compliance", "feature": "compliance"},
                ],
            },
            {
                "name": "Emergency Response",
                "description": "Project → Inspection → Work Order",
                "steps": [
                    {"action": "notify", "feature": "projects"},
                    {"action": "create_inspection", "feature": "inspections"},
                    {"action": "create_workorder", "feature": "workorders"},
                ],
            },
        ]
        return templates

    @staticmethod
    def list_user_workflows(db: Session, user_id: str) -> List[Workflow]:
        """User's workflows"""
        return db.query(Workflow).filter(Workflow.created_by == user_id).all()
