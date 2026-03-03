from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .db import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.viewer)
    name = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Product(Base):
    __tablename__ = "products"
    sku = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)


class CashflowMonth(Base):
    __tablename__ = "cashflow_months"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    entries = relationship("CashflowEntry", back_populates="month", cascade="all, delete-orphan")


class CashflowEntry(Base):
    __tablename__ = "cashflow_entries"
    id = Column(Integer, primary_key=True, index=True)
    month_id = Column(Integer, ForeignKey("cashflow_months.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(32), nullable=False)
    type = Column(String(8), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(128), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    month = relationship("CashflowMonth", back_populates="entries")


class DeletedCashflowEntry(Base):
    __tablename__ = "deleted_cashflow_entries"
    id = Column(Integer, primary_key=True, index=True)
    month_name = Column(String(64), nullable=False)
    date = Column(String(32), nullable=False)
    type = Column(String(8), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(128), nullable=False)
    notes = Column(Text, nullable=True)
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
