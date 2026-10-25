"""Project documents (RFP C.1, C.3, C.10, G.5), under /api/v1/projects/{project_id}/documents.

Anyone who can see the project can list and download its documents; filing, new versions and
archiving need update rights on the project (admins, and makers on projects they own). Every
filing, download and archive is written to the audit log.
"""
import uuid
from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import quote

from backend.app.api.routes_projects import _get_audit_metadata, _get_response_meta, _get_visible_project
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.middleware.security import client_ip
from backend.app.models.document import Document, DocumentClassification, DocumentVersion
from backend.app.schemas.common import ApiResponse
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.security.rls_service import RLSService
from backend.app.services.audit_chain import append_audit_log
from backend.app.services.document_service import ALLOWED_TYPES, DocumentRejected, DocumentService, FileContent
from backend.app.storage.storage_interface import get_storage_backend

router = APIRouter(prefix="/api/v1/projects/{project_id}/documents", tags=["documents"])


def _service(db: AsyncSession) -> DocumentService:
    if settings.DOCUMENT_STORAGE == "database":
        storage = get_storage_backend("database", db=db)
    else:
        storage = get_storage_backend(settings.DOCUMENT_STORAGE, base_path=settings.DOCUMENT_STORAGE_PATH)
    return DocumentService(storage, encryption_enabled=settings.DOCUMENT_ENCRYPTION,
                           max_bytes=settings.DOCUMENT_MAX_MB * 1024 * 1024)


def _version(v: DocumentVersion) -> Dict[str, Any]:
    return jsonable_encoder({
        "id": v.id, "version_number": v.version_number, "is_current": v.is_current == "Y", "file_name": v.file_name,
        "file_size_bytes": v.file_size_bytes, "mime_type": v.mime_type, "sha256": v.file_hash,
        "encrypted": v.content_encrypted == "Y", "upload_comment": v.upload_comment, "uploaded_by": v.created_by,
        "uploaded_at": v.created_at,
    })


def _document(d: Document, current: Optional[DocumentVersion]) -> Dict[str, Any]:
    return {
        **jsonable_encoder({
            "id": d.id, "document_code": d.document_code, "title": d.title, "description": d.description,
            "classification": d.classification, "status": d.status, "document_date": d.document_date,
            "expiry_date": d.expiry_date, "source_reference": d.source_reference, "version_count": d.file_count,
            "created_by": d.created_by, "created_at": d.created_at,
        }),
        "current_version": _version(current) if current else None,
    }


def _envelope(data: Any, user: CurrentUser, action: str, count: Optional[int] = None) -> ApiResponse:
    return ApiResponse(data=data, meta=_get_response_meta(total_count=count),
                       audit=_get_audit_metadata(user_id=user.username or "unknown", action=action))


async def _audit(db, request: Request, user: CurrentUser, doc: Document, action: str, reason: str, post=None):
    await append_audit_log(
        db, user_id=user.id or user.username, user_role=user.roles[0].value if user.roles else None,
        entity_type="DOCUMENT", entity_id=doc.id, action=action, reason=reason,
        post_state={"project_id": str(doc.project_id), "title": doc.title, **(post or {})},
        source_ip=client_ip(request.scope, settings.TRUSTED_PROXY_HOPS))


async def _writable_project(db, user: CurrentUser, project_id: str):
    project = await _get_visible_project(db, user, project_id)
    if not await RLSService.can_update_project(db, user, project.id):
        raise HTTPException(status_code=403, detail="You cannot file documents on this project")
    return project


async def _document_of(db, project_id, document_id: str) -> Document:
    try:
        did = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = (await db.execute(select(Document).where(Document.id == did, Document.project_id == project_id))).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


async def _read(upload: UploadFile, limit_bytes: int) -> FileContent:
    # Read one byte past the limit, so an oversized file is refused without holding all of it
    content = await upload.read(limit_bytes + 1)
    return FileContent(name=upload.filename or "file", content=content)


@router.get("/types")
async def document_types(project_id: str, user: CurrentUser = Depends(get_current_user)):
    """The document types and file types accepted, for the upload form."""
    return {"data": {"classifications": [c.value for c in DocumentClassification],
                     "extensions": sorted(ALLOWED_TYPES), "max_mb": settings.DOCUMENT_MAX_MB}}


@router.get("", response_model=ApiResponse[list[dict]])
async def list_documents(project_id: str, include_archived: bool = False, db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(get_current_user)):
    project = await _get_visible_project(db, user, project_id)
    service = _service(db)
    docs = await service.list_documents(db, project.id, include_archived)
    current = await service.current_versions(db, [d.id for d in docs])
    return _envelope([_document(d, current.get(d.id)) for d in docs], user, "list_documents", len(docs))


@router.post("", response_model=ApiResponse[dict], status_code=201)
async def file_document(
    project_id: str, request: Request,
    file: UploadFile = File(...), title: str = Form(...), classification: str = Form(...),
    document_date: Optional[date] = Form(None), expiry_date: Optional[date] = Form(None),
    description: Optional[str] = Form(None), source_reference: Optional[str] = Form(None),
    upload_comment: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user),
):
    project = await _writable_project(db, user, project_id)
    service = _service(db)
    try:
        doc, version = await service.create_document(
            db, project=project, title=title, classification=classification,
            file=await _read(file, service.max_bytes), user_id=user.username, document_date=document_date,
            expiry_date=expiry_date, description=description, source_reference=source_reference,
            upload_comment=upload_comment)
    except DocumentRejected as rejected:
        raise HTTPException(status_code=422, detail=str(rejected))
    await _audit(db, request, user, doc, "DOCUMENT_FILED", upload_comment or f"Filed {doc.title}",
                 {"version": 1, "file_name": version.file_name, "sha256": version.file_hash})
    payload = _document(doc, version)
    await db.commit()
    return _envelope(payload, user, "file_document")


@router.get("/{document_id}/versions", response_model=ApiResponse[list[dict]])
async def version_history(project_id: str, document_id: str, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(get_current_user)):
    project = await _get_visible_project(db, user, project_id)
    doc = await _document_of(db, project.id, document_id)
    versions = await _service(db).get_version_history(db, doc.id)
    return _envelope([_version(v) for v in versions], user, "document_versions", len(versions))


@router.post("/{document_id}/versions", response_model=ApiResponse[dict], status_code=201)
async def upload_version(project_id: str, document_id: str, request: Request, file: UploadFile = File(...),
                         upload_comment: str = Form(...), db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(get_current_user)):
    project = await _writable_project(db, user, project_id)
    doc = await _document_of(db, project.id, document_id)
    if not upload_comment.strip():
        raise HTTPException(status_code=422, detail="Say what changed in this version")
    service = _service(db)
    try:
        version = await service.add_version(db, doc, await _read(file, service.max_bytes), user_id=user.username,
                                            upload_comment=upload_comment.strip())
    except DocumentRejected as rejected:
        raise HTTPException(status_code=422, detail=str(rejected))
    await _audit(db, request, user, doc, "DOCUMENT_VERSION", upload_comment.strip(),
                 {"version": version.version_number, "file_name": version.file_name, "sha256": version.file_hash})
    payload = _document(doc, version)
    await db.commit()
    return _envelope(payload, user, "upload_version")


@router.get("/{document_id}/versions/{version_id}/download")
async def download_version(project_id: str, document_id: str, version_id: str, request: Request,
                           db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project = await _get_visible_project(db, user, project_id)
    doc = await _document_of(db, project.id, document_id)
    try:
        vid = uuid.UUID(version_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Version not found")
    version = (await db.execute(select(DocumentVersion).where(
        DocumentVersion.id == vid, DocumentVersion.document_id == doc.id))).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    try:
        content = await _service(db).read_version(version)
    except DocumentRejected as rejected:
        raise HTTPException(status_code=409, detail=str(rejected))
    await _audit(db, request, user, doc, "DOCUMENT_DOWNLOADED", f"Downloaded version {version.version_number}",
                 {"version": version.version_number})
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(version.file_name)}",
               "X-Content-SHA256": version.file_hash}
    media_type = version.mime_type or "application/octet-stream"
    await db.commit()
    return Response(content, media_type=media_type, headers=headers)


@router.post("/{document_id}/archive", response_model=ApiResponse[dict])
async def archive_document(project_id: str, document_id: str, request: Request, reason: str = Form(...),
                           db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project = await _writable_project(db, user, project_id)
    doc = await _document_of(db, project.id, document_id)
    if not reason.strip():
        raise HTTPException(status_code=422, detail="Give a reason for archiving")
    await _service(db).archive_document(db, doc, user.username)
    await _audit(db, request, user, doc, "DOCUMENT_ARCHIVED", reason.strip())
    payload = _document(doc, None)
    await db.commit()
    return _envelope(payload, user, "archive_document")
