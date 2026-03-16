"""add sms_suggestions table

Revision ID: 0017_sms_suggestions
Revises: 0016_bi_insights
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0017_sms_suggestions'
down_revision = '0016_bi_insights'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sms_suggestions',
        sa.Column('id',          sa.Integer(),     nullable=False, autoincrement=True),
        sa.Column('brand_id',    sa.Integer(),     nullable=False),
        sa.Column('raw_text',    sa.Text(),        nullable=True),
        sa.Column('amount',      sa.Float(),       nullable=False),
        sa.Column('description', sa.String(256),   nullable=True),
        sa.Column('ref_number',  sa.String(64),    nullable=True),
        sa.Column('tx_date',     sa.DateTime(),    nullable=True),
        sa.Column('status',      sa.String(16),    nullable=False, server_default='pending'),
        sa.Column('created_at',  sa.DateTime(),    nullable=False),
        sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('brand_id', 'ref_number', name='uq_sms_brand_ref'),
    )
    op.create_index('ix_sms_suggestions_brand_id', 'sms_suggestions', ['brand_id'])
    op.create_index('ix_sms_suggestions_status',   'sms_suggestions', ['status'])


def downgrade():
    op.drop_index('ix_sms_suggestions_status',   table_name='sms_suggestions')
    op.drop_index('ix_sms_suggestions_brand_id', table_name='sms_suggestions')
    op.drop_table('sms_suggestions')
