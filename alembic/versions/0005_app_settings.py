"""add app_settings table

Revision ID: 0005_app_settings
Revises: 0004_products_sold
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_app_settings'
down_revision = '0004_products_sold'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'app_settings',
        sa.Column('key',   sa.String(64), primary_key=True),
        sa.Column('value', sa.Text(),     nullable=True),
    )


def downgrade():
    op.drop_table('app_settings')
