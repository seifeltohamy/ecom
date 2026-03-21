"""make todo_tasks.column_id nullable for unassigned tasks

Revision ID: 0021_unassigned_tasks
Revises: 0020_todo_task_done
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0021_unassigned_tasks'
down_revision = '0020_todo_task_done'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('todo_tasks', 'column_id',
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    op.alter_column('todo_tasks', 'column_id',
        existing_type=sa.Integer(),
        nullable=False,
    )
