"""GraphQL endpoint for mobile API.

Type-safe GraphQL queries with cursor-based pagination and batch operations.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Any, Dict
import json

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.schemas.graphql_schema import schema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graphql", tags=["graphql"])


class GraphQLRequest(BaseModel):
    """GraphQL query request."""

    query: str
    operationName: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None


class GraphQLResponse(BaseModel):
    """GraphQL response with data and errors."""

    data: Optional[Dict[str, Any]] = None
    errors: Optional[list] = None


@router.post("", response_model=GraphQLResponse)
async def graphql_query(
    request: GraphQLRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute GraphQL query.

    Supports:
    - Queries: projects (paginated), project (by ID), portfolio_metrics, etc.
    - Mutations: update_project, etc.
    - Cursor-based pagination (first, after)
    - Field selection (reduces bandwidth)

    Example Query:
    ```graphql
    query GetProjects($first: Int, $status: String) {
      projects(first: $first, status: $status) {
        edges {
          node {
            id
            name
            capacity_mw
            rate
            status
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
    ```

    Example Variables:
    ```json
    {
      "first": 10,
      "status": "active"
    }
    ```
    """

    try:
        # Prepare context with database and user
        context = {
            "db": db,
            "user": current_user,
        }

        # Execute GraphQL query
        result = await schema.execute(
            request.query,
            variable_values=request.variables,
            operation_name=request.operationName,
            context_value=context,
        )

        # Check for errors
        if result.errors:
            logger.warning(f"GraphQL errors: {result.errors}")
            return GraphQLResponse(
                data=result.data,
                errors=[str(e) for e in result.errors],
            )

        return GraphQLResponse(data=result.data)

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in GraphQL request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in request body",
        )

    except Exception as e:
        logger.error(f"GraphQL execution failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GraphQL query execution failed",
        )


@router.post("/introspection")
async def graphql_introspection(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get GraphQL schema introspection for mobile clients.

    Returns schema information for autocompletion and validation.

    This endpoint helps mobile app developers:
    - Auto-discover available queries and mutations
    - Get field types and arguments
    - Validate queries before execution
    - Build dynamic UI based on schema
    """

    try:
        from graphql import get_introspection_query, build_ast_schema

        # Get introspection query
        introspection_query = get_introspection_query()

        # Execute introspection
        result = await schema.execute(introspection_query)

        if result.errors:
            logger.error(f"Introspection errors: {result.errors}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get schema introspection",
            )

        return result.data

    except Exception as e:
        logger.error(f"Introspection request failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Schema introspection failed",
        )


# Example GraphQL queries for reference
EXAMPLE_QUERIES = {
    "projects": """
    query GetProjects($first: Int, $after: String, $pipelineStatus: String) {
      projects(first: $first, after: $after, pipelineStatus: $pipelineStatus) {
        edges {
          node {
            id
            projectCode
            nameEn
            installedCapacityMw
            province
            pipelineStatus
            projectStage
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
          totalCount
        }
      }
    }
    """,
    "project_detail": """
    query GetProjectDetail($id: UUID!) {
      project(id: $id) {
        id
        projectCode
        nameEn
        nameNp
        installedCapacityMw
        province
        district
        pipelineStatus
        projectStage
        originalCodAd
        currentApprovedCodAd
        forecastCodAd
        actualCodAd
      }
      loanAccounts(projectId: $id) {
        id
        facilityType
        sanctionedAmount
        disbursedAmount
        outstandingPrincipal
        interestRatePct
        syncStatus
      }
    }
    """,
    "portfolio_metrics": """
    query GetPortfolioMetrics {
      portfolioMetrics {
        totalProjects
        activeProjects
        totalCapacityMw
        totalSanctioned
        totalDisbursed
        averageRatePct
      }
    }
    """,
    "current_user": """
    query GetCurrentUser {
      currentUser {
        id
        username
        email
        fullName
        isActive
        defaultRole
        languagePreference
      }
    }
    """,
    "update_project": """
    mutation UpdateProject($id: UUID!, $pipelineStatus: String, $dropReason: String) {
      updateProject(id: $id, pipelineStatus: $pipelineStatus, dropReason: $dropReason) {
        id
        pipelineStatus
        dropReason
      }
    }
    """,
}


@router.get("/examples")
async def get_example_queries(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get example GraphQL queries for mobile development.

    Returns:
        Dictionary of query name → GraphQL query string
    """

    return {
        "examples": EXAMPLE_QUERIES,
        "documentation": {
            "endpoint": "POST /graphql",
            "request_format": {
                "query": "GraphQL query string",
                "operationName": "Optional operation name",
                "variables": "Optional variables object",
            },
            "response_format": {
                "data": "Query results",
                "errors": "Array of error messages if any",
            },
            "pagination": {
                "strategy": "Cursor-based pagination",
                "first": "Number of items to return (max 100 for mobile)",
                "after": "Base64-encoded cursor for pagination",
                "pageInfo": "Contains hasNextPage, endCursor, totalCount",
            },
            "bandwidth_optimization": [
                "Query only required fields (no over-fetching)",
                "Use pagination for large result sets",
                "Leverage GraphQL field selection",
                "Responses compressed with gzip",
            ],
            "introspection": "POST /graphql/introspection for schema",
        },
    }
