"""File synthetic documents on the demo portfolio, so the Documents tab is not empty in a demo.

Each operating project gets a sanction letter (two versions: as issued, then revised), a power purchase
agreement and a feasibility study; each project under construction gets a sanction letter. Every PDF is
generated here and is stamped as synthetic demo material on every page. Nothing comes from the bank.

Run after seed_realistic_data (the demo reset runs it automatically):
    python -m backend.scripts.seed_demo_documents
"""

import asyncio
from datetime import date
from io import BytesIO
from typing import List

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.database import engine
from backend.app.models.document import Document
from backend.app.models.financial import LoanAccount
from backend.app.models.project import Project
from backend.app.services.document_service import DocumentService, FileContent
from backend.app.storage.storage_interface import get_storage_backend

SEEDED_BY = "seed_demo_documents"
CRORE = 10_000_000


def demo_pdf(title: str, lines: List[str]) -> bytes:
    """A one-page PDF, marked as synthetic."""
    buffer = BytesIO()
    page = canvas.Canvas(buffer, pagesize=A4, invariant=1)  # invariant: the same input gives the same bytes
    width, height = A4
    page.setFont("Helvetica-Bold", 16)
    page.drawString(56, height - 72, title)
    page.setFont("Helvetica", 11)
    y = height - 108
    for line in lines:
        page.drawString(56, y, line)
        y -= 18
    page.setFont("Helvetica-Oblique", 9)
    page.drawString(56, 40, "SYNTHETIC DEMO DOCUMENT - not issued by any bank or authority")
    page.showPage()
    page.save()
    return buffer.getvalue()


def _service(db: AsyncSession) -> DocumentService:
    if settings.DOCUMENT_STORAGE == "database":
        storage = get_storage_backend("database", db=db)
    else:
        storage = get_storage_backend(settings.DOCUMENT_STORAGE, base_path=settings.DOCUMENT_STORAGE_PATH)
    return DocumentService(storage, encryption_enabled=settings.DOCUMENT_ENCRYPTION)


async def seed(db: AsyncSession) -> int:
    """File the demo documents. Returns how many were filed; 0 when they already exist."""
    if (await db.execute(select(Document.id).where(Document.created_by == SEEDED_BY).limit(1))).first():
        return 0
    service = _service(db)
    rows = (await db.execute(
        select(Project, LoanAccount).join(LoanAccount, LoanAccount.project_id == Project.id)
        .where(Project.project_stage.in_(("operation", "construction"))).order_by(Project.project_code))).all()
    filed = 0
    for project, loan in rows:
        limit_crore = float(loan.sanctioned_amount) / CRORE
        letter = [f"Borrower project: {project.name_en} ({project.project_code})",
                  f"Installed capacity: {project.installed_capacity_mw} MW",
                  f"Facility: {loan.facility_type.replace('_', ' ')}",
                  f"Sanctioned limit: NPR {limit_crore:,.2f} crore",
                  f"Interest rate: {loan.interest_rate_pct}% per annum, reviewed quarterly"]
        doc, _ = await service.create_document(
            db, project=project, title="Sanction letter", classification="sanction_letter",
            file=FileContent("sanction-letter.pdf", demo_pdf("Sanction letter", letter)), user_id=SEEDED_BY,
            document_date=date(2022, 1, 10), source_reference=f"SL/{project.project_code}",
            upload_comment="As issued")
        filed += 1
        if project.project_stage != "operation":
            continue
        await service.add_version(
            db, doc, FileContent("sanction-letter-revised.pdf",
                                 demo_pdf("Sanction letter (revised)", letter + ["Revision: tenor and covenants restated"])),
            user_id=SEEDED_BY, upload_comment="Revised after the annual review")
        for title, kind, name, when, lines in (
            ("Power purchase agreement", "ppa", "ppa.pdf", date(2019, 5, 20),
             [f"Seller: {project.name_en}", "Buyer: national utility (illustrative)", "Contract energy and tariff per schedule"]),
            ("Feasibility study", "feasibility_study", "feasibility-study.pdf", date(2017, 3, 1),
             [f"Project: {project.name_en}", f"Capacity studied: {project.installed_capacity_mw} MW", "Hydrology, geology, cost estimate"]),
        ):
            await service.create_document(db, project=project, title=title, classification=kind,
                                          file=FileContent(name, demo_pdf(title, lines)), user_id=SEEDED_BY,
                                          document_date=when)
            filed += 1
    return filed


async def main() -> int:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        count = await seed(session)
        await session.commit()
    return count


if __name__ == "__main__":
    print(f"Filed {asyncio.run(main())} demo documents")
