"""add todo_activities, todo_columns, todo_tasks tables

Revision ID: 0019_todo_board
Revises: 0018_sms_suggestion_type
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = '0019_todo_board'
down_revision = '0018_sms_suggestion_type'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'todo_activities',
        sa.Column('id',         sa.Integer(),    nullable=False, autoincrement=True),
        sa.Column('brand_id',   sa.Integer(),    nullable=False),
        sa.Column('name',       sa.String(128),  nullable=False),
        sa.Column('sort_order', sa.Integer(),    nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('brand_id', 'name', name='uq_todo_act_brand_name'),
    )
    op.create_index('ix_todo_activities_brand_id', 'todo_activities', ['brand_id'])

    op.create_table(
        'todo_columns',
        sa.Column('id',         sa.Integer(),    nullable=False, autoincrement=True),
        sa.Column('brand_id',   sa.Integer(),    nullable=False),
        sa.Column('name',       sa.String(128),  nullable=False),
        sa.Column('sort_order', sa.Integer(),    nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('brand_id', 'name', name='uq_todo_col_brand_name'),
    )
    op.create_index('ix_todo_columns_brand_id', 'todo_columns', ['brand_id'])

    op.create_table(
        'todo_tasks',
        sa.Column('id',          sa.Integer(),    nullable=False, autoincrement=True),
        sa.Column('brand_id',    sa.Integer(),    nullable=False),
        sa.Column('column_id',   sa.Integer(),    nullable=False),
        sa.Column('activity_id', sa.Integer(),    nullable=True),
        sa.Column('title',       sa.String(256),  nullable=False),
        sa.Column('deadline',    sa.String(32),   nullable=True),
        sa.Column('notes',       sa.Text(),       nullable=True),
        sa.Column('sort_order',  sa.Integer(),    nullable=False, server_default='0'),
        sa.Column('created_at',  sa.DateTime(),   nullable=False),
        sa.ForeignKeyConstraint(['brand_id'],    ['brands.id'],         ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['column_id'],   ['todo_columns.id'],   ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['activity_id'], ['todo_activities.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_todo_tasks_column_id',   'todo_tasks', ['column_id'])
    op.create_index('ix_todo_tasks_activity_id', 'todo_tasks', ['activity_id'])


def downgrade():
    op.drop_index('ix_todo_tasks_activity_id', table_name='todo_tasks')
    op.drop_index('ix_todo_tasks_column_id',   table_name='todo_tasks')
    op.drop_table('todo_tasks')

    op.drop_index('ix_todo_columns_brand_id', table_name='todo_columns')
    op.drop_table('todo_columns')

    op.drop_index('ix_todo_activities_brand_id', table_name='todo_activities')
    op.drop_table('todo_activities')
