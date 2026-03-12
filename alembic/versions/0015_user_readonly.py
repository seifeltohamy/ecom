"""add read_only flag to users

Revision ID: 0015_user_readonly
Revises: 0014_user_permissions
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = '0015_user_readonly'
down_revision = '0014_user_permissions'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('read_only', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('users', 'read_only')
