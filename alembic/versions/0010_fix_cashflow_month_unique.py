"""fix cashflow_months unique constraint to be per-brand

Revision ID: 0010_fix_cashflow_month_unique
Revises: 0009_cashflow_categories
Create Date: 2026-03-11
"""
from alembic import op

revision = '0010_fix_cashflow_month_unique'
down_revision = '0009_cashflow_categories'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old global UNIQUE(name) constraint
    op.drop_constraint('cashflow_months_name_key', 'cashflow_months', type_='unique')
    # Add per-brand UNIQUE(name, brand_id)
    op.create_unique_constraint('uq_cashflow_month_name_brand', 'cashflow_months', ['name', 'brand_id'])


def downgrade() -> None:
    op.drop_constraint('uq_cashflow_month_name_brand', 'cashflow_months', type_='unique')
    op.create_unique_constraint('cashflow_months_name_key', 'cashflow_months', ['name'])
