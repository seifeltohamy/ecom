"""add bosta_reports table

Revision ID: 0002_bosta_reports
Revises: 0001_initial
Create Date: 2026-03-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_bosta_reports'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'bosta_reports',
        sa.Column('id',             sa.Integer(),  primary_key=True),
        sa.Column('uploaded_at',    sa.DateTime(), nullable=False),
        sa.Column('date_from',      sa.String(16), nullable=True),
        sa.Column('date_to',        sa.String(16), nullable=True),
        sa.Column('order_count',    sa.Integer(),  nullable=False),
        sa.Column('grand_quantity', sa.Integer(),  nullable=False),
        sa.Column('grand_revenue',  sa.Float(),    nullable=False),
        sa.Column('rows_json',      sa.Text(),     nullable=False),
    )


def downgrade() -> None:
    op.drop_table('bosta_reports')
