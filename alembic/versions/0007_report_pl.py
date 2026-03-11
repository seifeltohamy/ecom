"""report p&l storage

Revision ID: 0007_report_pl
Revises: 0006_multi_tenant
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0007_report_pl'
down_revision = '0006_multi_tenant'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bosta_reports', sa.Column('ads_spent', sa.Float(), nullable=True))
    op.create_table(
        'bosta_report_pl',
        sa.Column('report_id', sa.Integer(), sa.ForeignKey('bosta_reports.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('sku',        sa.String(64), primary_key=True),
        sa.Column('price',      sa.Float(), nullable=True),
        sa.Column('cost',       sa.Float(), nullable=True),
        sa.Column('extra_cost', sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('bosta_report_pl')
    op.drop_column('bosta_reports', 'ads_spent')
