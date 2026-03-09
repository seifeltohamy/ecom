"""initial tables

Revision ID: 0001_initial
Revises: 
Create Date: 2026-02-28
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('admin', 'viewer', name='userrole'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'products',
        sa.Column('sku', sa.String(length=64), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
    )
    op.create_table(
        'cashflow_months',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=64), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'cashflow_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('month_id', sa.Integer(), sa.ForeignKey('cashflow_months.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.String(length=32), nullable=False),
        sa.Column('type', sa.String(length=8), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('category', sa.String(length=128), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'deleted_cashflow_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('month_name', sa.String(length=64), nullable=False),
        sa.Column('date', sa.String(length=32), nullable=False),
        sa.Column('type', sa.String(length=8), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('category', sa.String(length=128), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('month_name', 'id', name='uq_deleted_month_id')
    )


def downgrade() -> None:
    op.drop_table('deleted_cashflow_entries')
    op.drop_table('cashflow_entries')
    op.drop_table('cashflow_months')
    op.drop_table('products')
    op.drop_table('users')
    op.execute('DROP TYPE IF EXISTS userrole')
