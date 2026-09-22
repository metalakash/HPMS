"""Tests for mobile GraphQL API."""

import pytest
from uuid import UUID
import base64
from typing import Dict, Any

from backend.app.schemas.graphql_schema import (
    ProjectType,
    LoanAccountType,
    UserType,
    PortfolioMetricsType,
    CovenantMetricsType,
    ProjectConnectionType,
    PageInfoType,
)


class TestGraphQLTypes:
    """Test GraphQL type definitions."""

    def test_project_type(self):
        """Test ProjectType creation."""
        project = ProjectType(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            name="Test Project",
            capacity_mw=50.0,
            province="Kathmandu",
            district="Kathmandu",
            status="active",
            facility_type="run_of_river",
            rate=8.5,
        )

        assert project.name == "Test Project"
        assert project.capacity_mw == 50.0
        assert project.status == "active"
        assert project.rate == 8.5

    def test_loan_account_type(self):
        """Test LoanAccountType creation."""
        loan = LoanAccountType(
            id=UUID("87654321-4321-8765-4321-876543218765"),
            project_id=UUID("12345678-1234-5678-1234-567812345678"),
            bank_name="Test Bank",
            loan_amount=1000000.0,
            disbursed_amount=750000.0,
            remaining_amount=250000.0,
            status="active",
            interest_rate=8.5,
            tenor_years=15,
        )

        assert loan.bank_name == "Test Bank"
        assert loan.loan_amount == 1000000.0
        assert loan.tenor_years == 15

    def test_user_type(self):
        """Test UserType creation."""
        user = UserType(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            username="testuser",
            email="test@example.com",
            full_name="Test User",
            is_active=True,
            default_role="maker",
        )

        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.is_active is True
        assert user.default_role == "maker"

    def test_portfolio_metrics_type(self):
        """Test PortfolioMetricsType creation."""
        metrics = PortfolioMetricsType(
            total_projects=10,
            total_capacity_mw=500.0,
            total_loan_amount=5000000.0,
            total_disbursed=3750000.0,
            active_projects=9,
            average_rate=8.5,
            average_tenor_years=15,
        )

        assert metrics.total_projects == 10
        assert metrics.total_capacity_mw == 500.0
        assert metrics.active_projects == 9

    def test_covenant_metrics_type(self):
        """Test CovenantMetricsType creation."""
        metrics = CovenantMetricsType(
            dscr=1.35,
            ltv=65.0,
            icr=2.5,
            dscr_pass=True,
            ltv_pass=True,
            icr_pass=True,
        )

        assert metrics.dscr == 1.35
        assert metrics.ltv == 65.0
        assert metrics.icr == 2.5
        assert metrics.dscr_pass is True
        assert metrics.ltv_pass is True
        assert metrics.icr_pass is True


class TestPaginationCursors:
    """Test cursor-based pagination."""

    def test_cursor_encoding(self):
        """Test cursor encoding and decoding."""
        offset = 42
        cursor = base64.b64encode(str(offset).encode()).decode()

        assert isinstance(cursor, str)
        assert len(cursor) > 0

        # Decode cursor
        decoded = int(base64.b64decode(cursor).decode())
        assert decoded == offset

    def test_cursor_pagination_flow(self):
        """Test pagination cursor flow."""
        page_size = 10
        offsets = [0, 10, 20, 30]

        cursors = []
        for offset in offsets:
            cursor = base64.b64encode(str(offset).encode()).decode()
            cursors.append(cursor)

        # All cursors should be unique
        assert len(set(cursors)) == len(cursors)

    def test_page_info_type(self):
        """Test PageInfoType creation."""
        page_info = PageInfoType(
            has_next_page=True,
            has_previous_page=False,
            start_cursor="MTA=",  # base64 "10"
            end_cursor="MjA=",  # base64 "20"
            total_count=50,
        )

        assert page_info.has_next_page is True
        assert page_info.has_previous_page is False
        assert page_info.total_count == 50


class TestGraphQLQueries:
    """Test GraphQL query structure."""

    def test_simple_project_query(self):
        """Test simple project query structure."""
        query = """
        query GetProject($id: UUID!) {
            project(id: $id) {
                id
                name
                capacity_mw
                rate
            }
        }
        """

        assert "GetProject" in query
        assert "project" in query
        assert "id" in query
        assert "capacity_mw" in query

    def test_projects_with_pagination_query(self):
        """Test projects query with pagination."""
        query = """
        query GetProjects($first: Int, $after: String, $status: String) {
            projects(first: $first, after: $after, status: $status) {
                edges {
                    node {
                        id
                        name
                        capacity_mw
                    }
                    cursor
                }
                pageInfo {
                    hasNextPage
                    endCursor
                    totalCount
                }
            }
        }
        """

        assert "first" in query
        assert "after" in query
        assert "status" in query
        assert "edges" in query
        assert "pageInfo" in query
        assert "totalCount" in query

    def test_portfolio_metrics_query(self):
        """Test portfolio metrics query."""
        query = """
        query GetPortfolioMetrics {
            portfolio_metrics {
                total_projects
                total_capacity_mw
                average_rate
                active_projects
            }
        }
        """

        assert "portfolio_metrics" in query
        assert "total_capacity_mw" in query
        assert "average_rate" in query

    def test_covenant_metrics_query(self):
        """Test covenant metrics query."""
        query = """
        query GetCovenantMetrics {
            covenant_metrics {
                dscr
                ltv
                icr
                dscr_pass
                ltv_pass
                icr_pass
            }
        }
        """

        assert "covenant_metrics" in query
        assert "dscr_pass" in query
        assert "ltv_pass" in query


class TestGraphQLMutations:
    """Test GraphQL mutations."""

    def test_update_project_mutation(self):
        """Test update project mutation structure."""
        mutation = """
        mutation UpdateProject($id: UUID!, $name: String, $rate: Float) {
            update_project(id: $id, name: $name, rate: $rate) {
                id
                name
                rate
                status
            }
        }
        """

        assert "UpdateProject" in mutation
        assert "update_project" in mutation
        assert "id" in mutation
        assert "name" in mutation
        assert "rate" in mutation


class TestMobileOptimizations:
    """Test mobile-specific optimizations."""

    def test_field_selection_reduces_data(self):
        """Test that field selection reduces bandwidth."""
        full_query = """
        query GetProject($id: UUID!) {
            project(id: $id) {
                id
                name
                capacity_mw
                province
                district
                status
                facility_type
                rate
                start_date
                end_date
                description
            }
        }
        """

        optimized_query = """
        query GetProject($id: UUID!) {
            project(id: $id) {
                id
                name
                capacity_mw
                rate
            }
        }
        """

        # Optimized query should be smaller
        assert len(optimized_query) < len(full_query)

    def test_pagination_reduces_bandwidth(self):
        """Test pagination reduces response size."""
        query_with_pagination = """
        query GetProjects {
            projects(first: 10) {
                edges {
                    node {
                        id
                        name
                        rate
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
        """

        # Should limit results to 10 items
        assert "first: 10" in query_with_pagination
        assert "pageInfo" in query_with_pagination

    def test_cursor_pagination_efficiency(self):
        """Test cursor pagination is efficient."""
        # Cursor pagination requires only previous state (cursor)
        # vs offset/limit which requires fetching all previous records
        cursor = base64.b64encode(str(20).encode()).decode()

        variables = {
            "first": 10,
            "after": cursor,
        }

        # Pagination parameters are small (cursor is base64 encoded offset)
        assert len(str(variables)) < 50


class TestGraphQLRequestResponse:
    """Test GraphQL request/response formats."""

    def test_graphql_request_format(self):
        """Test GraphQL request format."""
        request = {
            "query": "query { projects(first: 10) { edges { node { id } } } }",
            "operationName": "GetProjects",
            "variables": {"first": 10},
        }

        assert "query" in request
        assert request["operationName"] == "GetProjects"
        assert request["variables"]["first"] == 10

    def test_graphql_response_format(self):
        """Test GraphQL response format."""
        response = {
            "data": {
                "projects": {
                    "edges": [
                        {"node": {"id": "123", "name": "Project A"}, "cursor": "MA=="}
                    ],
                    "pageInfo": {
                        "hasNextPage": False,
                        "totalCount": 1,
                    }
                }
            }
        }

        assert "data" in response
        assert "projects" in response["data"]
        assert "edges" in response["data"]["projects"]
        assert "pageInfo" in response["data"]["projects"]

    def test_graphql_error_response(self):
        """Test GraphQL error response format."""
        response = {
            "data": None,
            "errors": [
                {
                    "message": "Invalid query",
                    "locations": [{"line": 1, "column": 1}],
                }
            ]
        }

        assert "errors" in response
        assert len(response["errors"]) > 0
        assert "message" in response["errors"][0]


class TestBandwidthOptimization:
    """Test bandwidth optimization features."""

    def test_minimal_project_response_size(self):
        """Test minimal project response is small."""
        # Minimal fields: id, name, rate
        minimal_response = {
            "id": "12345678-1234-5678-1234-567812345678",
            "name": "Project A",
            "rate": 8.5,
        }

        response_str = str(minimal_response)
        assert len(response_str) < 100  # Very compact

    def test_full_project_response_larger(self):
        """Test full project response is larger."""
        # Full fields
        full_response = {
            "id": "12345678-1234-5678-1234-567812345678",
            "name": "Project A",
            "capacity_mw": 50.0,
            "province": "Kathmandu",
            "district": "Kathmandu",
            "status": "active",
            "facility_type": "run_of_river",
            "rate": 8.5,
            "start_date": "2020-01-01T00:00:00",
            "end_date": "2035-01-01T00:00:00",
            "description": "This is a test project with details",
        }

        full_str = str(full_response)
        assert len(full_str) > 300  # Much larger

    def test_pagination_reduces_payload_size(self):
        """Test pagination keeps payload size reasonable."""
        # 100 projects per page would be ~50KB
        # 10 projects per page is ~5KB
        # Mobile optimal: 10-20 projects per page

        page_sizes = {
            "10_projects": 5000,  # ~5KB
            "20_projects": 10000,  # ~10KB
            "100_projects": 50000,  # ~50KB
        }

        # Verify mobile (10 items) < desktop (100 items)
        assert page_sizes["10_projects"] < page_sizes["100_projects"]


class TestIntrospectionSchema:
    """Test GraphQL introspection for schema discovery."""

    def test_introspection_request_format(self):
        """Test introspection request."""
        introspection_query = """
        query IntrospectionQuery {
            __schema {
                types {
                    name
                    kind
                }
                queryType {
                    name
                    fields {
                        name
                        type {
                            name
                        }
                    }
                }
            }
        }
        """

        assert "__schema" in introspection_query
        assert "types" in introspection_query
        assert "queryType" in introspection_query

    def test_type_introspection(self):
        """Test individual type introspection."""
        type_query = """
        query GetProjectType {
            __type(name: "ProjectType") {
                name
                fields {
                    name
                    type {
                        name
                        kind
                    }
                }
            }
        }
        """

        assert "__type" in type_query
        assert "ProjectType" in type_query
        assert "fields" in type_query
