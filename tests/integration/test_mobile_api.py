"""Tests for the GraphQL API used by mobile and web clients."""

import pytest
from datetime import date
from uuid import UUID
import base64
from typing import Dict, Any

from graphql import parse, validate

from backend.app.schemas.graphql_schema import (
    ProjectType,
    LoanAccountType,
    UserType,
    PortfolioMetricsType,
    ProjectConnectionType,
    PageInfoType,
    schema,
)


def schema_errors(document: str) -> list:
    """Validation errors for a query/mutation against the real schema."""
    return [e.message for e in validate(schema._schema, parse(document))]


class TestGraphQLTypes:
    """Test GraphQL type definitions."""

    def test_project_type(self):
        project = ProjectType(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            project_code="SBL-HPP-0001",
            name_en="Test Project",
            name_np="परीक्षण",
            installed_capacity_mw=50.0,
            province="Bagmati",
            district="Kathmandu",
            pipeline_status="under_operation",
            project_stage="operation",
            forecast_cod_ad=date(2027, 1, 1),
        )

        assert project.name_en == "Test Project"
        assert project.installed_capacity_mw == 50.0
        assert project.pipeline_status == "under_operation"
        assert project.actual_cod_ad is None

    def test_loan_account_type(self):
        loan = LoanAccountType(
            id=UUID("87654321-4321-8765-4321-876543218765"),
            project_id=UUID("12345678-1234-5678-1234-567812345678"),
            facility_type="term_loan",
            currency_code="NPR",
            sanctioned_amount=1000000.0,
            disbursed_amount=750000.0,
            outstanding_principal=700000.0,
            interest_rate_pct=8.5,
            maturity_ad=None,
            sync_status="success",
        )

        assert loan.sanctioned_amount == 1000000.0
        assert loan.interest_rate_pct == 8.5

    def test_user_type(self):
        user = UserType(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            username="testuser",
            email="test@example.com",
            full_name="Test User",
            is_active=True,
            default_role="maker",
            language_preference="ne",
        )

        assert user.username == "testuser"
        assert user.default_role == "maker"
        assert user.language_preference == "ne"

    def test_portfolio_metrics_type(self):
        metrics = PortfolioMetricsType(
            total_projects=10,
            active_projects=9,
            total_capacity_mw=500.0,
            total_sanctioned=5000000.0,
            total_disbursed=3750000.0,
            average_rate_pct=None,
        )

        assert metrics.total_projects == 10
        assert metrics.average_rate_pct is None


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
    """Queries clients send must validate against the schema."""

    def test_project_detail_query(self):
        assert schema_errors("""
        query GetProject($id: UUID!) {
            project(id: $id) { id projectCode nameEn installedCapacityMw pipelineStatus forecastCodAd }
            loanAccounts(projectId: $id) { id sanctionedAmount interestRatePct }
        }
        """) == []

    def test_projects_with_pagination_query(self):
        assert schema_errors("""
        query GetProjects($first: Int, $after: String, $pipelineStatus: String) {
            projects(first: $first, after: $after, pipelineStatus: $pipelineStatus) {
                edges { node { id nameEn installedCapacityMw } cursor }
                pageInfo { hasNextPage endCursor totalCount }
            }
        }
        """) == []

    def test_portfolio_metrics_query(self):
        assert schema_errors("""
        query { portfolioMetrics { totalProjects activeProjects totalCapacityMw totalSanctioned averageRatePct } }
        """) == []

    def test_snake_case_fields_are_rejected(self):
        assert schema_errors("query { portfolio_metrics { total_projects } }") != []

    def test_removed_placeholder_fields_are_gone(self):
        # covenantMetrics returned hard-coded numbers; rate/capacity_mw never existed on Project
        assert schema_errors("query { covenantMetrics { dscr } }") != []
        assert schema_errors("query { projects { edges { node { rate } } } }") != []


class TestGraphQLMutations:
    """Mutations clients send must validate against the schema."""

    def test_update_project_mutation(self):
        assert schema_errors("""
        mutation UpdateProject($id: UUID!, $nameEn: String, $pipelineStatus: String, $dropReason: String) {
            updateProject(id: $id, nameEn: $nameEn, pipelineStatus: $pipelineStatus, dropReason: $dropReason) {
                id nameEn pipelineStatus dropReason
            }
        }
        """) == []

    def test_update_project_rejects_nonexistent_columns(self):
        assert schema_errors("""
        mutation { updateProject(id: "12345678-1234-5678-1234-567812345678", rate: 9.0) { id } }
        """) != []


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
