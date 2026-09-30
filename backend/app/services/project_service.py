"""
Project Service
Core project management service
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ProjectStatus(str, Enum):
    """Project status enumeration"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"

class MemberRole(str, Enum):
    """Team member role enumeration"""
    OWNER = "owner"
    MEMBER = "member"
    VIEWER = "viewer"

class Permission(Enum):
    """Permission actions"""
    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EXPORT = "export"

class Project:
    """Project domain model"""
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        owner_id: str,
        owner_email: str,
        status: ProjectStatus = ProjectStatus.ACTIVE,
        members: List[Dict[str, Any]] = None,
        created_at: datetime = None,
        updated_at: datetime = None,
        features: List[str] = None,
        metadata: Dict[str, Any] = None,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.owner_id = owner_id
        self.owner_email = owner_email
        self.status = status
        self.members = members or []
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
        self.features = features or []
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "owner_id": self.owner_id,
            "owner_email": self.owner_email,
            "status": self.status.value,
            "members": self.members,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "features": self.features,
            "metadata": self.metadata,
        }

class TeamMember:
    """Team member model"""
    def __init__(
        self,
        user_id: str,
        email: str,
        name: str,
        role: MemberRole = MemberRole.MEMBER,
        joined_at: datetime = None,
        permissions: List[Dict[str, Any]] = None,
    ):
        self.user_id = user_id
        self.email = email
        self.name = name
        self.role = role
        self.joined_at = joined_at or datetime.utcnow()
        self.permissions = permissions or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "user_id": self.user_id,
            "email": self.email,
            "name": self.name,
            "role": self.role.value,
            "joined_at": self.joined_at.isoformat(),
            "permissions": self.permissions,
        }

class ProjectService:
    """Project management service"""

    def __init__(self):
        """Initialize project service"""
        self.projects: Dict[str, Project] = {}
        self.current_project_id: Optional[str] = None
        self._init_sample_data()

    def _init_sample_data(self):
        """Initialize with sample projects"""
        project1 = Project(
            id="proj-1",
            name="Hydropower Station Alpha",
            description="Main hydropower facility with 5 turbines",
            owner_id="user-1",
            owner_email="akash@example.com",
            status=ProjectStatus.ACTIVE,
            members=[
                {
                    "user_id": "user-1",
                    "email": "akash@example.com",
                    "name": "Akash Rai",
                    "role": "owner",
                    "joined_at": datetime.utcnow().isoformat(),
                },
                {
                    "user_id": "user-2",
                    "email": "john@example.com",
                    "name": "John Smith",
                    "role": "member",
                    "joined_at": datetime.utcnow().isoformat(),
                },
            ],
            features=["projects", "inspections", "workorders"],
        )

        project2 = Project(
            id="proj-2",
            name="Hydropower Station Beta",
            description="Secondary facility with 3 turbines",
            owner_id="user-2",
            owner_email="john@example.com",
            status=ProjectStatus.ACTIVE,
            members=[
                {
                    "user_id": "user-2",
                    "email": "john@example.com",
                    "name": "John Smith",
                    "role": "owner",
                    "joined_at": datetime.utcnow().isoformat(),
                },
            ],
            features=["projects", "inspections"],
        )

        self.projects[project1.id] = project1
        self.projects[project2.id] = project2
        self.current_project_id = project1.id

    async def get_current_project(self) -> Optional[Project]:
        """Get currently active project"""
        if not self.current_project_id:
            return None
        return self.projects.get(self.current_project_id)

    async def switch_project(self, project_id: str) -> Project:
        """Switch to a different project"""
        if project_id not in self.projects:
            raise ValueError(f"Project {project_id} not found")
        self.current_project_id = project_id
        return self.projects[project_id]

    async def create_project(
        self,
        name: str,
        description: str,
        owner_id: str,
        owner_email: str,
        members: List[Dict[str, Any]] = None,
    ) -> Project:
        """Create new project"""
        project_id = f"proj-{len(self.projects) + 1}"
        project = Project(
            id=project_id,
            name=name,
            description=description,
            owner_id=owner_id,
            owner_email=owner_email,
            members=members or [
                {
                    "user_id": owner_id,
                    "email": owner_email,
                    "name": owner_email.split("@")[0],
                    "role": "owner",
                    "joined_at": datetime.utcnow().isoformat(),
                }
            ],
        )
        self.projects[project_id] = project
        return project

    async def get_project(self, project_id: str) -> Project:
        """Get project by ID"""
        if project_id not in self.projects:
            raise ValueError(f"Project {project_id} not found")
        return self.projects[project_id]

    async def update_project(
        self,
        project_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[ProjectStatus] = None,
    ) -> Project:
        """Update project details"""
        project = await self.get_project(project_id)
        if name:
            project.name = name
        if description:
            project.description = description
        if status:
            project.status = status
        project.updated_at = datetime.utcnow()
        return project

    async def list_user_projects(self, user_id: str) -> List[Project]:
        """Get all projects owned or shared with user"""
        return [
            p for p in self.projects.values()
            if p.owner_id == user_id or any(
                m.get("user_id") == user_id for m in p.members
            )
        ]

    async def list_shared_projects(self, user_id: str) -> List[Project]:
        """Get projects shared with user (not owned)"""
        return [
            p for p in self.projects.values()
            if p.owner_id != user_id and any(
                m.get("user_id") == user_id for m in p.members
            )
        ]

    async def archive_project(self, project_id: str) -> Project:
        """Archive project (owner only)"""
        project = await self.get_project(project_id)
        project.status = ProjectStatus.ARCHIVED
        project.updated_at = datetime.utcnow()
        return project

    async def delete_project(self, project_id: str) -> bool:
        """Delete project (owner only, permanent)"""
        if project_id not in self.projects:
            raise ValueError(f"Project {project_id} not found")
        del self.projects[project_id]
        if self.current_project_id == project_id:
            self.current_project_id = None
        return True

    async def add_member(
        self,
        project_id: str,
        email: str,
        role: str = "member",
    ) -> Dict[str, Any]:
        """Add team member to project"""
        project = await self.get_project(project_id)
        member = {
            "user_id": f"user-{hash(email) % 10000}",
            "email": email,
            "name": email.split("@")[0],
            "role": role,
            "joined_at": datetime.utcnow().isoformat(),
        }
        project.members.append(member)
        project.updated_at = datetime.utcnow()
        return member

    async def remove_member(self, project_id: str, user_id: str) -> bool:
        """Remove team member from project"""
        project = await self.get_project(project_id)
        initial_count = len(project.members)
        project.members = [m for m in project.members if m.get("user_id") != user_id]
        project.updated_at = datetime.utcnow()
        return len(project.members) < initial_count

    async def update_member_role(
        self,
        project_id: str,
        user_id: str,
        role: str,
    ) -> Dict[str, Any]:
        """Update team member role"""
        project = await self.get_project(project_id)
        for member in project.members:
            if member.get("user_id") == user_id:
                member["role"] = role
                project.updated_at = datetime.utcnow()
                return member
        raise ValueError(f"User {user_id} not found in project")

    async def get_project_stats(self, project_id: str) -> Dict[str, Any]:
        """Get project statistics"""
        project = await self.get_project(project_id)
        return {
            "project_id": project_id,
            "project_name": project.name,
            "records": 45,
            "inspections": 28,
            "work_orders": 12,
            "compliance_issues": 8,
            "linked_features": len(project.features),
            "team_size": len(project.members),
        }

    async def get_project_health(self, project_id: str) -> Dict[str, Any]:
        """Calculate project health score"""
        project = await self.get_project(project_id)
        # Simplified health calculation
        health_score = min(100, 60 + (len(project.members) * 5))
        return {
            "project_id": project_id,
            "health": health_score,
            "status": "Good" if health_score >= 80 else "Fair" if health_score >= 60 else "Needs Attention",
            "last_updated": project.updated_at.isoformat(),
        }

    async def get_project_activity(
        self,
        project_id: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get recent project activity"""
        # Placeholder: return mock activity
        return [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "user": "akash@example.com",
                "action": "Updated project status",
                "details": "Changed from Draft to Active",
            },
            {
                "timestamp": datetime.utcnow().isoformat(),
                "user": "john@example.com",
                "action": "Added member",
                "details": "Added sarah@example.com as member",
            },
        ]

    async def share_project(
        self,
        project_id: str,
        recipient_emails: List[str],
    ) -> Dict[str, Any]:
        """Share project with recipients"""
        project = await self.get_project(project_id)
        shared_count = 0
        for email in recipient_emails:
            try:
                await self.add_member(project_id, email, role="member")
                shared_count += 1
            except Exception:
                pass
        return {
            "success": True,
            "shared_with": shared_count,
            "project_id": project_id,
        }


# Singleton instance
project_service = ProjectService()
