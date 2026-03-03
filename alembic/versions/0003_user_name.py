"""add name column to users

Revision ID: 0003_user_name
Revises: 0002_bosta_reports
"""
from alembic import op
import sqlalchemy as sa

revision = '0003_user_name'
down_revision = '0002_bosta_reports'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('name', sa.String(128), nullable=True))


def downgrade():
    op.drop_column('users', 'name')
