"""product_adsets table — maps products to Meta ad sets for P&L tracking."""

revision = "0026_product_adsets"
down_revision = "0025_product_price"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        "product_adsets",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("brand_id", sa.Integer, sa.ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("adset_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("brand_id", "sku", "adset_id", name="uq_product_adset"),
    )


def downgrade():
    op.drop_table("product_adsets")
