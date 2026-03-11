"""add cost_formula and extra_cost_formula to bosta_report_pl

Revision ID: 0008_pl_formulas
Revises: 0007_report_pl
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0008_pl_formulas'
down_revision = '0007_report_pl'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bosta_report_pl', sa.Column('cost_formula',       sa.Text(), nullable=True))
    op.add_column('bosta_report_pl', sa.Column('extra_cost_formula', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('bosta_report_pl', 'cost_formula')
    op.drop_column('bosta_report_pl', 'extra_cost_formula')
