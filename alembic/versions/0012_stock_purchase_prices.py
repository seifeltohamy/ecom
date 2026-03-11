"""add stock_purchase_prices table

Revision ID: 0012_stock_purchase_prices
Revises: 0011_add_indexes
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = '0012_stock_purchase_prices'
down_revision = '0011_add_indexes'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stock_purchase_prices',
        sa.Column('id',             sa.Integer(),     primary_key=True),
        sa.Column('brand_id',       sa.Integer(),     sa.ForeignKey('brands.id'), nullable=False),
        sa.Column('sku',            sa.String(64),    nullable=False),
        sa.Column('purchase_price', sa.Float(),       nullable=False, server_default='0'),
        sa.UniqueConstraint('brand_id', 'sku', name='uq_spp_brand_sku'),
    )
    op.create_index('ix_spp_brand_id', 'stock_purchase_prices', ['brand_id'])


def downgrade():
    op.drop_index('ix_spp_brand_id', table_name='stock_purchase_prices')
    op.drop_table('stock_purchase_prices')
