"""add wallet_entries table for cross-month master wallet

Revision ID: 0022_wallet_entries
Revises: 0021_unassigned_tasks
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0022_wallet_entries'
down_revision = '0021_unassigned_tasks'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'wallet_entries',
        sa.Column('id',            sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('brand_id',      sa.Integer(), sa.ForeignKey('brands.id'), nullable=False),
        sa.Column('month_name',    sa.String(64), nullable=False),
        sa.Column('month_net',     sa.Float(), nullable=False),
        sa.Column('balance_after', sa.Float(), nullable=False),
        sa.Column('created_at',    sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('wallet_entries')
