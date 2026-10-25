"""Documents on hosting without a persistent disk, and the same file filed more than once.

``document_blobs`` holds file content when ``DOCUMENT_STORAGE=database`` (the default), so uploads
survive a redeploy. A version's ``file_hash`` was unique, which refused the same file filed on two
projects or as two documents; it stays indexed for lookups.
"""
from alembic import op
import sqlalchemy as sa

revision = '028_document_storage'
down_revision = '027_project_bank_financed'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'document_blobs',
        sa.Column('storage_path', sa.String(500), primary_key=True),
        sa.Column('content', sa.LargeBinary, nullable=False),
        sa.Column('size_bytes', sa.Integer, nullable=False),
    )
    op.execute("ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS document_versions_file_hash_key")


def downgrade():
    op.create_unique_constraint('document_versions_file_hash_key', 'document_versions', ['file_hash'])
    op.drop_table('document_blobs')
