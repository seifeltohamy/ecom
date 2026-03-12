"""user permissions: allowed_pages + allowed_brand_ids on users

Revision ID: 0014_user_permissions
Revises: 0013_sku_cost_items
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = '0014_user_permissions'
down_revision = '0013_sku_cost_items'
branch_labels = None
depends_on = None


def upgrade():
    # JSON arrays stored as TEXT; NULL = unrestricted (all pages / all brands)
    op.add_column('users', sa.Column('allowed_pages',     sa.Text(), nullable=True))
    op.add_column('users', sa.Column('allowed_brand_ids', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('users', 'allowed_brand_ids')
    op.drop_column('users', 'allowed_pages')
