"""add done column to todo_tasks

Revision ID: 0020_todo_task_done
Revises: 0019_todo_board
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = '0020_todo_task_done'
down_revision = '0019_todo_board'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('todo_tasks', sa.Column('done', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('todo_tasks', 'done')
