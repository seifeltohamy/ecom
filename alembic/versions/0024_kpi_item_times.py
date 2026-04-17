"""KPI: move schedule to per-item time slots"""

revision = "0024_kpi_item_times"
down_revision = "0023_kpi_checklist"

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Add times JSON array to kpi_items
    op.add_column("kpi_items", sa.Column("times", sa.Text, nullable=True))

    # Add time_slot to kpi_checks
    op.add_column("kpi_checks", sa.Column("time_slot", sa.String(8), nullable=True))

    # Drop old unique constraint and create new one with time_slot
    op.drop_constraint("uq_kpi_check_item_user_date", "kpi_checks", type_="unique")
    op.create_unique_constraint(
        "uq_kpi_check_item_user_date_slot",
        "kpi_checks",
        ["item_id", "user_id", "date", "time_slot"],
    )

    # Remove schedule from kpi_categories (no longer needed)
    op.drop_column("kpi_categories", "schedule")


def downgrade():
    op.add_column("kpi_categories", sa.Column("schedule", sa.String(32), nullable=True))
    op.drop_constraint("uq_kpi_check_item_user_date_slot", "kpi_checks", type_="unique")
    op.create_unique_constraint(
        "uq_kpi_check_item_user_date",
        "kpi_checks",
        ["item_id", "user_id", "date"],
    )
    op.drop_column("kpi_checks", "time_slot")
    op.drop_column("kpi_items", "times")
