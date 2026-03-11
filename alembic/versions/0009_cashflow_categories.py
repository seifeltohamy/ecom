"""per-brand cashflow categories table

Revision ID: 0009_cashflow_categories
Revises: 0008_pl_formulas
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0009_cashflow_categories'
down_revision = '0008_pl_formulas'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'cashflow_categories',
        sa.Column('id',         sa.Integer(),     primary_key=True),
        sa.Column('brand_id',   sa.Integer(),     sa.ForeignKey('brands.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type',       sa.String(8),     nullable=False),   # 'in' | 'out'
        sa.Column('name',       sa.String(128),   nullable=False),
        sa.Column('sort_order', sa.Integer(),     nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(),    nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('brand_id', 'type', 'name', name='uq_cat_brand_type_name'),
    )
    op.create_index('ix_cashflow_categories_brand_type', 'cashflow_categories', ['brand_id', 'type'])


def downgrade() -> None:
    op.drop_index('ix_cashflow_categories_brand_type', 'cashflow_categories')
    op.drop_table('cashflow_categories')
