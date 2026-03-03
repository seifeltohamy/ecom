"""add products_sold_manual table

Revision ID: 0004_products_sold
Revises: 0003_user_name
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_products_sold'
down_revision = '0003_user_name'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'products_sold_manual',
        sa.Column('id',         sa.Integer(),     primary_key=True, index=True),
        sa.Column('month_id',   sa.Integer(),     sa.ForeignKey('cashflow_months.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sku',        sa.String(64),    nullable=False),
        sa.Column('price',      sa.Float(),       nullable=True),
        sa.Column('new_price',  sa.Float(),       nullable=True),
        sa.Column('cost',       sa.Float(),       nullable=True),
        sa.Column('extra_cost', sa.Float(),       nullable=True),
        sa.Column('expense',    sa.Float(),       nullable=True),
        sa.UniqueConstraint('month_id', 'sku', name='uq_ps_month_sku'),
    )


def downgrade():
    op.drop_table('products_sold_manual')
