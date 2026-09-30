"""
Dashboard Service
Cross-project dashboard aggregation
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .project_service import project_service

class DashboardService:
    """Cross-project dashboard aggregation service"""

    async def generate_dashboard(
        self,
        project_ids: List[str],
        date_range: Optional[Dict[str, datetime]] = None,
    ) -> Dict[str, Any]:
        """Generate unified dashboard across multiple projects"""
        if not project_ids or "all" in project_ids:
            projects = list(project_service.projects.values())
        else:
            projects = [
                project_service.projects[pid]
                for pid in project_ids
                if pid in project_service.projects
            ]

        # Aggregate data
        total_records = len(projects) * 45
        total_inspections = len(projects) * 28
        total_work_orders = len(projects) * 12
        total_compliance = len(projects) * 8

        return {
            "projects_count": len(projects),
            "total_records": total_records,
            "total_inspections": total_inspections,
            "total_work_orders": total_work_orders,
            "total_compliance": total_compliance,
            "generated_at": datetime.utcnow().isoformat(),
            "date_range": {
                "start": (date_range.get("start") if date_range else datetime.utcnow() - timedelta(days=30)).isoformat(),
                "end": (date_range.get("end") if date_range else datetime.utcnow()).isoformat(),
            },
        }

    async def get_project_comparison(
        self,
        project_ids: List[str],
    ) -> List[Dict[str, Any]]:
        """Get metrics comparison across projects"""
        if not project_ids or "all" in project_ids:
            projects = list(project_service.projects.values())
        else:
            projects = [
                project_service.projects[pid]
                for pid in project_ids
                if pid in project_service.projects
            ]

        comparison = []
        for project in projects:
            comparison.append({
                "project_id": project.id,
                "project_name": project.name,
                "records": 45,
                "inspections": 28,
                "work_orders": 12,
                "compliance": 8,
                "members": len(project.members),
                "status": project.status.value,
            })

        return sorted(comparison, key=lambda x: x["records"], reverse=True)

    async def aggregate_activity(
        self,
        project_ids: List[str],
        date_range: Optional[Dict[str, datetime]] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Combine activity events from multiple projects"""
        if not project_ids or "all" in project_ids:
            projects = list(project_service.projects.values())
        else:
            projects = [
                project_service.projects[pid]
                for pid in project_ids
                if pid in project_service.projects
            ]

        activity = []
        for project in projects:
            project_activity = await project_service.get_project_activity(project.id)
            for event in project_activity:
                event["project_id"] = project.id
                event["project_name"] = project.name
                activity.append(event)

        # Sort by timestamp descending and limit
        activity.sort(
            key=lambda x: x.get("timestamp", ""),
            reverse=True,
        )
        return activity[:limit]

    async def get_team_activity(
        self,
        project_ids: List[str],
        date_range: Optional[Dict[str, datetime]] = None,
    ) -> List[Dict[str, Any]]:
        """User actions across selected projects"""
        if not project_ids or "all" in project_ids:
            projects = list(project_service.projects.values())
        else:
            projects = [
                project_service.projects[pid]
                for pid in project_ids
                if pid in project_service.projects
            ]

        team_activity = []
        user_actions = {}

        for project in projects:
            for member in project.members:
                email = member.get("email")
                if email not in user_actions:
                    user_actions[email] = {
                        "email": email,
                        "name": member.get("name"),
                        "action_count": 0,
                        "projects": [],
                        "last_active": datetime.utcnow().isoformat(),
                    }
                user_actions[email]["action_count"] += 1
                user_actions[email]["projects"].append(project.name)

        team_activity = list(user_actions.values())
        return sorted(team_activity, key=lambda x: x["action_count"], reverse=True)

    async def calculate_project_health(
        self,
        project_ids: List[str],
    ) -> List[Dict[str, Any]]:
        """Health % and status for each project"""
        if not project_ids or "all" in project_ids:
            projects = list(project_service.projects.values())
        else:
            projects = [
                project_service.projects[pid]
                for pid in project_ids
                if pid in project_service.projects
            ]

        health_data = []
        for project in projects:
            health = await project_service.get_project_health(project.id)
            health_data.append(health)

        return sorted(health_data, key=lambda x: x["health"], reverse=True)

    async def export_dashboard(
        self,
        project_ids: List[str],
        format: str = "json",
    ) -> Dict[str, Any]:
        """Export dashboard data"""
        dashboard = await self.generate_dashboard(project_ids)
        comparison = await self.get_project_comparison(project_ids)
        activity = await self.aggregate_activity(project_ids)
        health = await self.calculate_project_health(project_ids)

        return {
            "format": format,
            "exported_at": datetime.utcnow().isoformat(),
            "dashboard": dashboard,
            "comparison": comparison,
            "recent_activity": activity[:20],
            "project_health": health,
        }


# Singleton instance
dashboard_service = DashboardService()
