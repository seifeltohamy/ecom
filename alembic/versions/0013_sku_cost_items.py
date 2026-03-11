"""add sku_cost_items table

Revision ID: 0013_sku_cost_items
Revises: 0012_stock_purchase_prices
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = '0013_sku_cost_items'
down_revision = '0012_stock_purchase_prices'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sku_cost_items',
        sa.Column('id',       sa.Integer(),    primary_key=True, autoincrement=True),
        sa.Column('brand_id', sa.Integer(),    sa.ForeignKey('brands.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sku',      sa.String(64),   nullable=False),
        sa.Column('name',     sa.String(128),  nullable=False),
        sa.Column('amount',   sa.Float(),      nullable=False, server_default='0'),
        sa.UniqueConstraint('brand_id', 'sku', 'name', name='uq_sci_brand_sku_name'),
    )
    op.create_index('ix_sci_brand_id', 'sku_cost_items', ['brand_id'])
    op.create_index('ix_sci_brand_sku', 'sku_cost_items', ['brand_id', 'sku'])


def downgrade():
    op.drop_index('ix_sci_brand_sku', table_name='sku_cost_items')
    op.drop_index('ix_sci_brand_id', table_name='sku_cost_items')
    op.drop_table('sku_cost_items')
