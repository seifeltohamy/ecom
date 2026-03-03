from pydantic import BaseModel


class ProductIn(BaseModel):
    sku: str
    name: str


class CashflowMonthIn(BaseModel):
    month: str


class CashflowEntryIn(BaseModel):
    id: int
    date: str
    type: str
    amount: float
    category: str
    notes: str | None = ""


class DeletedCashflowIn(BaseModel):
    id: int
    date: str
    type: str
    amount: float
    category: str
    notes: str | None = ""
    month: str | None = ""


class CashflowEntryUpdate(BaseModel):
    date: str
    type: str
    amount: float
    category: str
    notes: str | None = ""


class UserNameUpdate(BaseModel):
    name: str
