"""KPI daily checklist: kpi_categories, kpi_items, kpi_checks + users.notification_email"""

revision = "0023_kpi_checklist"
down_revision = "0022_wallet_entries"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        "kpi_categories",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("brand_id", sa.Integer, sa.ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("schedule", sa.String(32), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("brand_id", "name", name="uq_kpi_cat_brand_name"),
    )

    op.create_table(
        "kpi_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("kpi_categories.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "kpi_checks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("brand_id", sa.Integer, sa.ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_id", sa.Integer, sa.ForeignKey("kpi_items.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("checked_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("date", sa.String(16), nullable=False),
        sa.UniqueConstraint("item_id", "user_id", "date", name="uq_kpi_check_item_user_date"),
    )

    op.add_column("users", sa.Column("notification_email", sa.String(255), nullable=True))


def downgrade():
    op.drop_column("users", "notification_email")
    op.drop_table("kpi_checks")
    op.drop_table("kpi_items")
    op.drop_table("kpi_categories")
