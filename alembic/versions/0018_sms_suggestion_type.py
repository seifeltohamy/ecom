"""add type and category columns to sms_suggestions

Revision ID: 0018_sms_suggestion_type
Revises: 0017_sms_suggestions
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0018_sms_suggestion_type'
down_revision = '0017_sms_suggestions'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sms_suggestions', sa.Column('type',     sa.String(8),   nullable=False, server_default='out'))
    op.add_column('sms_suggestions', sa.Column('category', sa.String(128), nullable=True))


def downgrade():
    op.drop_column('sms_suggestions', 'category')
    op.drop_column('sms_suggestions', 'type')
