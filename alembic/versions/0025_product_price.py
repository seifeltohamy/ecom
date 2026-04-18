"""Add price column to products table for user-set selling price override."""

revision = "0025_product_price"
down_revision = "0024_kpi_item_times"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column("products", sa.Column("price", sa.Float, nullable=True))


def downgrade():
    op.drop_column("products", "price")
