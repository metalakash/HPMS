# Phase 6 Backend Defects - Fixed

## Summary
Fixed 5 critical defects in HPMS backend found while building Phase 6 React frontend. All fixes include pytest tests.

## Defects Fixed

### 1. HTTPAuthCredentials Import Error (CRITICAL)
**File:** `backend/app/security/auth_middleware.py`, `backend/app/api/routes_ws.py`

**Issue:** FastAPI 0.141 removed `HTTPAuthCredentials` class (renamed to `HTTPAuthorizationCredentials`). App would not start.

**Fix:**
- Changed import from `from fastapi.security import HTTPBearer, HTTPAuthCredentials`  
- To: `from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials`  
- Removed unused import from `routes_ws.py` (WebSocket doesn't use HTTPBearer)

**Test:** `test_imports_dont_fail`, `test_http_auth_credentials_available`, `test_routes_ws_no_unused_imports`

---

### 2. WebSocket Auth Failure - Missing `sub` Claim in JWT
**File:** `backend/app/security/auth_middleware.py`

**Issue:** 
- `routes_ws.py` expects `payload.get("sub")` to extract user_id
- But `TokenManager.create_token()` never added `sub` claim to JWT
- Every `/ws/notifications` connection failed with 1008 (policy violation)

**Fix:**
- Added `"sub": ad_user.username` to JWT payload in `TokenManager.create_token()`
- Uses username as stable subject identifier (JWT RFC 7519 standard)
- WebSocket handler can now read `user_id = payload.get("sub")`

**Test:** `test_token_creation_includes_sub_claim`, `test_token_payload_contains_user_claims`, `test_websocket_validates_sub_claim`

---

### 3. CurrentUser Missing `id` Attribute
**File:** `backend/app/security/auth_middleware.py`

**Issue:**
- Multiple endpoints (`routes_mfa.py`, `routes_graphql.py`, `routes_reports.py`) access `current_user.id`
- But `CurrentUser` class had no `id` attribute → AttributeError on every MFA/GraphQL request

**Fix:**
- Added `self.id = token_payload.get("sub")` to `CurrentUser.__init__()` 
- `id` is now set from JWT `sub` claim (username)

**Test:** `test_current_user_has_id_from_sub`, `test_current_user_role_checks`

---

### 4. GET /api/v1/auth/me Uses Wrong Dependency (Query Param)
**File:** `backend/app/api/routes_auth.py`

**Issue:**
- Endpoint used `Depends(TokenManager.verify_token)` 
- `verify_token` has parameter `token: str` → FastAPI treats it as query parameter
- Authorization header was ignored; token must be in `?token=...` query
- Should read from `Authorization: Bearer <token>` header

**Fix:**
- Changed to `current_user: CurrentUser = Depends(get_current_user)` 
- `get_current_user()` properly extracts Bearer token from Authorization header
- Response now includes `id` field from `sub` claim

**Test:** `test_auth_me_endpoint_imports_dependency`, `test_auth_me_endpoint_returns_user_with_id`

---

### 5. GraphQL Schema Field Mappings Broken
**File:** `backend/app/schemas/graphql_schema.py`

**Issue:**
- `ProjectType` defined fields that don't exist on Project model:
  - `name` → Project has `name_en`, `name_np`
  - `capacity_mw` → Project has `installed_capacity_mw`
  - `status` → Project has `pipeline_status`, `project_stage`
  - `facility_type` → No such column
- Resolvers tried to access non-existent columns → AttributeError on all GraphQL queries
- Errors swallowed, null returned to mobile clients

**Fix:**
- Updated `ProjectType` to use correct model columns:
  - `name_en` (English localized name)
  - `installed_capacity_mw` (MW capacity)
  - `pipeline_status` (under_operation, proposal_under_pipeline, etc.)
  - `project_stage` (feasibility, construction, operation)
  - `project_code` (unique identifier)
  - `original_cod_ad`, `forecast_cod_ad` (COD dates)
- Updated all resolver methods (`project()`, `projects()`, `portfolio_metrics()`) to use correct column names
- Fixed portfolio_metrics to filter by `pipeline_status == "under_operation"` (not missing `status` column)

**Test:** `test_graphql_project_type_has_correct_fields`, `test_graphql_query_resolver_uses_correct_columns`

---

### 6. CORS Missing Vite Dev Server Port (Phase 6)
**File:** `backend/app/main.py`

**Issue:**
- Frontend Phase 6 uses Vite dev server on `localhost:5173`
- CORS only allowed `localhost:3000` (old React dev server)
- Frontend requests blocked with 403 CORS error

**Fix:**
- Added `"http://localhost:5173"` to CORS `allow_origins`
- Also kept 3000, 8080 for backward compatibility
- Added documentation comments

**Test:** `test_cors_middleware_allows_localhost_5173`, `test_cors_allows_multiple_dev_ports`

---

## Dependencies Added
**File:** `pyproject.toml`

Installed missing dependencies (not in original venv):
- `asyncpg>=0.29.0` – async PostgreSQL driver (database.py uses it)
- `python-jose[cryptography]>=3.3.0` – JWT token support
- `ldap3>=2.9.1` – LDAP/AD authentication
- `email-validator>=2.1.0` – Email validation
- `strawberry-graphql>=0.220.0` – GraphQL support
- `pyotp>=2.9.0` – MFA TOTP
- `qrcode[pil]>=7.4.2` – QR code generation
- `reportlab>=4.0.0` – PDF generation
- `PyPDF2>=3.0.0` – PDF processing
- `openpyxl>=3.1.0` – Excel export
- `boto3>=1.34.0` – AWS S3 storage
- `aiosmtplib>=3.0.0` – Email sending
- `redis>=5.0.0` – Redis client

---

## Test Coverage
**File:** `tests/test_phase6_backend_defects.py`

16 comprehensive tests covering:
- Import error fixes (3 tests)
- JWT `sub` claim (2 tests)
- CurrentUser `id` attribute (2 tests)
- GET /auth/me endpoint (2 tests)
- GraphQL schema mappings (2 tests)
- CORS configuration (2 tests)
- WebSocket auth integration (2 tests)
- Role checking logic (1 test)

**All tests passing:** ✅ 16/16

---

## Impact on Frontend
Frontend workarounds no longer needed:
- ✅ REST API `/auth/me` now works correctly
- ✅ WebSocket `/ws/notifications` can authenticate
- ✅ GraphQL queries return correct data
- ✅ CORS allows Vite dev server

---

## Files Modified
1. `backend/app/security/auth_middleware.py` – Import fix, `sub` claim, `id` attribute
2. `backend/app/api/routes_ws.py` – Remove unused import
3. `backend/app/api/routes_auth.py` – Fix `/me` dependency, return user with `id`
4. `backend/app/schemas/graphql_schema.py` – Fix all field mappings
5. `backend/app/main.py` – Add `localhost:5173` to CORS
6. `pyproject.toml` – Add missing dependencies
7. `tests/test_phase6_backend_defects.py` – NEW: Comprehensive test suite

---

## Verification
```bash
# Run all defect tests
pytest tests/test_phase6_backend_defects.py -v

# Result: 16 passed
```

---

## Frontend Integration Notes
The Phase 6 React frontend (`frontend/`) can now:
1. Call GET `/api/v1/auth/me` without query param workaround
2. Open WebSocket `/ws/notifications` and receive real-time notifications
3. Query GraphQL `/graphql` with correct field mappings
4. Connect from `localhost:5173` without CORS errors
