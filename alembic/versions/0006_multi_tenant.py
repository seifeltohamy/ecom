"""multi-tenant brands

Revision ID: 0006_multi_tenant
Revises: 0005_app_settings
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = '0006_multi_tenant'
down_revision = '0005_app_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create brands table
    op.create_table(
        'brands',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(128), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 2. Seed the default "Zen" brand
    op.execute("INSERT INTO brands (name, created_at) VALUES ('Zen', NOW())")

    # 3. Add nullable brand_id to all business tables
    business_tables = [
        'users', 'products', 'cashflow_months', 'bosta_reports',
        'products_sold_manual', 'deleted_cashflow_entries',
    ]
    for table in business_tables:
        op.add_column(table, sa.Column('brand_id', sa.Integer(), nullable=True))

    # app_settings needs brand_id too (will fix PK later)
    op.add_column('app_settings', sa.Column('brand_id', sa.Integer(), nullable=True))

    # 4. Backfill all existing rows → brand_id = 1 (Zen)
    all_tables = business_tables + ['app_settings']
    for table in all_tables:
        op.execute(f"UPDATE {table} SET brand_id = 1")

    # 5. Admin users get brand_id = NULL (they are superadmin, pick brand at login)
    op.execute("UPDATE users SET brand_id = NULL WHERE role = 'admin'")

    # 6. Make brand_id NOT NULL on all tables except users (admin stays nullable)
    not_null_tables = [
        'products', 'cashflow_months', 'bosta_reports',
        'products_sold_manual', 'deleted_cashflow_entries', 'app_settings',
    ]
    for table in not_null_tables:
        op.alter_column(table, 'brand_id', nullable=False)

    # 7. Add FK constraints
    for table in all_tables:
        op.create_foreign_key(
            f'fk_{table}_brand_id', table, 'brands', ['brand_id'], ['id']
        )

    # 8. Fix app_settings PK: drop old PK on (key), create composite PK (key, brand_id)
    op.drop_constraint('app_settings_pkey', 'app_settings', type_='primary')
    op.create_primary_key('app_settings_pkey', 'app_settings', ['key', 'brand_id'])


def downgrade() -> None:
    # Restore app_settings PK to just (key)
    op.drop_constraint('app_settings_pkey', 'app_settings', type_='primary')
    op.create_primary_key('app_settings_pkey', 'app_settings', ['key'])

    all_tables = [
        'users', 'products', 'cashflow_months', 'bosta_reports',
        'products_sold_manual', 'deleted_cashflow_entries', 'app_settings',
    ]
    for table in all_tables:
        op.drop_constraint(f'fk_{table}_brand_id', table, type_='foreignkey')
        op.drop_column(table, 'brand_id')

    op.drop_table('brands')
