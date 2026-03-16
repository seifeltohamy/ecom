from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .db import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    viewer = "viewer"


class Brand(Base):
    __tablename__ = "brands"
    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(128), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class User(Base):
    __tablename__ = "users"
    id                = Column(Integer, primary_key=True, index=True)
    email             = Column(String(255), unique=True, index=True, nullable=False)
    password_hash     = Column(String(255), nullable=False)
    role              = Column(Enum(UserRole), nullable=False, default=UserRole.viewer)
    name              = Column(String(128), nullable=True)
    brand_id          = Column(Integer, ForeignKey("brands.id"), nullable=True)  # NULL = admin
    created_at        = Column(DateTime, default=datetime.utcnow, nullable=False)
    # JSON TEXT arrays; NULL means unrestricted
    allowed_pages     = Column(Text, nullable=True)   # viewer page whitelist, e.g. '["/","/cashflow"]'
    allowed_brand_ids = Column(Text, nullable=True)   # admin brand whitelist, e.g. '[1,3]'
    read_only         = Column(Boolean, nullable=False, default=False, server_default='false')


class Product(Base):
    __tablename__ = "products"
    sku      = Column(String(64), primary_key=True)
    name     = Column(String(255), nullable=False)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False)


class CashflowMonth(Base):
    __tablename__ = "cashflow_months"
    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(64), nullable=False)
    brand_id   = Column(Integer, ForeignKey("brands.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    entries = relationship("CashflowEntry", back_populates="month", cascade="all, delete-orphan")


class CashflowEntry(Base):
    __tablename__ = "cashflow_entries"
    id       = Column(Integer, primary_key=True, index=True)
    month_id = Column(Integer, ForeignKey("cashflow_months.id", ondelete="CASCADE"), nullable=False, index=True)
    date     = Column(String(32), nullable=False)
    type     = Column(String(8), nullable=False)
    amount   = Column(Float, nullable=False)
    category = Column(String(128), nullable=False)
    notes    = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    month = relationship("CashflowMonth", back_populates="entries")


class DeletedCashflowEntry(Base):
    __tablename__ = "deleted_cashflow_entries"
    id         = Column(Integer, primary_key=True, index=True)
    month_name = Column(String(64), nullable=False)
    date       = Column(String(32), nullable=False)
    type       = Column(String(8), nullable=False)
    amount     = Column(Float, nullable=False)
    category   = Column(String(128), nullable=False)
    notes      = Column(Text, nullable=True)
    brand_id   = Column(Integer, ForeignKey("brands.id"), nullable=False)
    deleted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("month_name", "id", name="uq_deleted_month_id"),
    )


class BostaReport(Base):
    __tablename__ = "bosta_reports"
    id             = Column(Integer, primary_key=True, index=True)
    uploaded_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_from      = Column(String(16), nullable=True)
    date_to        = Column(String(16), nullable=True)
    order_count    = Column(Integer,  nullable=False, default=0)
    grand_quantity = Column(Integer,  nullable=False, default=0)
    grand_revenue  = Column(Float,    nullable=False, default=0.0)
    rows_json      = Column(Text,     nullable=False, default="[]")
    brand_id       = Column(Integer, ForeignKey("brands.id"), nullable=False)
    ads_spent      = Column(Float, nullable=True)


class BostaReportPl(Base):
    __tablename__ = "bosta_report_pl"
    report_id          = Column(Integer, ForeignKey("bosta_reports.id", ondelete="CASCADE"), primary_key=True)
    sku                = Column(String(64), primary_key=True)
    price              = Column(Float, nullable=True)
    cost               = Column(Float, nullable=True)
    extra_cost         = Column(Float, nullable=True)
    cost_formula       = Column(Text, nullable=True)
    extra_cost_formula = Column(Text, nullable=True)


class CashflowCategory(Base):
    __tablename__ = "cashflow_categories"
    id         = Column(Integer, primary_key=True, index=True)
    brand_id   = Column(Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    type       = Column(String(8),   nullable=False)    # 'in' | 'out'
    name       = Column(String(128), nullable=False)
    sort_order = Column(Integer,     nullable=False, default=0)
    created_at = Column(DateTime,    default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("brand_id", "type", "name", name="uq_cat_brand_type_name"),)


class ProductsSoldManual(Base):
    __tablename__ = "products_sold_manual"
    id         = Column(Integer, primary_key=True, index=True)
    month_id   = Column(Integer, ForeignKey("cashflow_months.id", ondelete="CASCADE"), nullable=False)
    sku        = Column(String(64), nullable=False)
    price      = Column(Float, nullable=True)
    new_price  = Column(Float, nullable=True)
    cost       = Column(Float, nullable=True)
    extra_cost = Column(Float, nullable=True)
    expense    = Column(Float, nullable=True)

    __table_args__ = (UniqueConstraint("month_id", "sku", name="uq_ps_month_sku"),)


class AppSettings(Base):
    __tablename__ = "app_settings"
    key      = Column(String(64), primary_key=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), primary_key=True)
    value    = Column(Text, nullable=True)


class StockPurchasePrice(Base):
    __tablename__ = "stock_purchase_prices"
    id             = Column(Integer, primary_key=True, index=True)
    brand_id       = Column(Integer, ForeignKey("brands.id"), nullable=False)
    sku            = Column(String(64), nullable=False)
    purchase_price = Column(Float, nullable=False, default=0.0)

    __table_args__ = (UniqueConstraint("brand_id", "sku", name="uq_spp_brand_sku"),)


class SkuCostItem(Base):
    __tablename__ = "sku_cost_items"
    id       = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    sku      = Column(String(64), nullable=False)
    name     = Column(String(128), nullable=False)
    amount   = Column(Float, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("brand_id", "sku", "name", name="uq_sci_brand_sku_name"),)


class BiInsight(Base):
    __tablename__ = "bi_insights"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    brand_id        = Column(Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    user_id         = Column(Integer, nullable=True)
    question        = Column(Text, nullable=False)
    answer          = Column(Text, nullable=False)
    model           = Column(String(64), nullable=True)
    prompt_tokens   = Column(Integer, nullable=True)
    response_tokens = Column(Integer, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)


class SmsSuggestion(Base):
    __tablename__ = "sms_suggestions"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    brand_id    = Column(Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    raw_text    = Column(Text, nullable=True)
    amount      = Column(Float, nullable=False)
    description = Column(String(256), nullable=True)
    ref_number  = Column(String(64), nullable=True)
    tx_date     = Column(DateTime, nullable=True)
    type        = Column(String(8),   nullable=False, default="out")   # "in" or "out"
    category    = Column(String(128), nullable=True)                   # pre-assigned (e.g. "Bosta")
    status      = Column(String(16), nullable=False, default="pending")
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("brand_id", "ref_number", name="uq_sms_brand_ref"),)
