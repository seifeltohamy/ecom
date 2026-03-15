"""add bi_insights table

Revision ID: 0016_bi_insights
Revises: 0015_user_readonly
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = '0016_bi_insights'
down_revision = '0015_user_readonly'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'bi_insights',
        sa.Column('id',              sa.Integer(),    nullable=False, autoincrement=True),
        sa.Column('brand_id',        sa.Integer(),    nullable=False),
        sa.Column('user_id',         sa.Integer(),    nullable=True),
        sa.Column('question',        sa.Text(),       nullable=False),
        sa.Column('answer',          sa.Text(),       nullable=False),
        sa.Column('model',           sa.String(64),   nullable=True),
        sa.Column('prompt_tokens',   sa.Integer(),    nullable=True),
        sa.Column('response_tokens', sa.Integer(),    nullable=True),
        sa.Column('created_at',      sa.DateTime(),   nullable=False),
        sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_bi_insights_brand_id',   'bi_insights', ['brand_id'])
    op.create_index('ix_bi_insights_created_at', 'bi_insights', ['created_at'])


def downgrade():
    op.drop_index('ix_bi_insights_created_at', table_name='bi_insights')
    op.drop_index('ix_bi_insights_brand_id',   table_name='bi_insights')
    op.drop_table('bi_insights')
