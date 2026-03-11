"""add brand_id and sorting indexes

Revision ID: 0011_add_indexes
Revises: 0010_fix_cashflow_month_unique
Create Date: 2026-03-11
"""
from alembic import op

revision = '0011_add_indexes'
down_revision = '0010_fix_cashflow_month_unique'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_cashflow_months_brand_id',     'cashflow_months',     ['brand_id'])
    op.create_index('ix_bosta_reports_brand_id',       'bosta_reports',       ['brand_id'])
    op.create_index('ix_bosta_reports_uploaded_at',    'bosta_reports',       ['uploaded_at'])
    op.create_index('ix_cashflow_categories_brand_id', 'cashflow_categories', ['brand_id'])
    op.create_index('ix_products_brand_id',            'products',            ['brand_id'])
    op.create_index('ix_users_brand_id',               'users',               ['brand_id'])
    op.create_index('ix_cashflow_entries_created_at',  'cashflow_entries',    ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_cashflow_entries_created_at',  table_name='cashflow_entries')
    op.drop_index('ix_users_brand_id',               table_name='users')
    op.drop_index('ix_products_brand_id',            table_name='products')
    op.drop_index('ix_cashflow_categories_brand_id', table_name='cashflow_categories')
    op.drop_index('ix_bosta_reports_uploaded_at',    table_name='bosta_reports')
    op.drop_index('ix_bosta_reports_brand_id',       table_name='bosta_reports')
    op.drop_index('ix_cashflow_months_brand_id',     table_name='cashflow_months')
