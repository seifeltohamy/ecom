import json
import os
from datetime import datetime as _dt

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.deps import get_db, get_current_user, get_brand_id
from app import models

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)


def _build_snapshot(brand_id: int) -> dict:
    """Build a bounded data snapshot for Gemini context."""
    with get_db() as db:
        # ── Cashflow ─────────────────────────────────────────────────────────
        months = (
            db.query(models.CashflowMonth)
            .filter(models.CashflowMonth.brand_id == brand_id)
            .order_by(models.CashflowMonth.created_at.desc())
            .limit(6)
            .all()
        )
        cashflow_months = []
        for m in reversed(months):
            entries = db.query(models.CashflowEntry).filter(
                models.CashflowEntry.month_id == m.id
            ).all()
            total_in  = sum(e.amount for e in entries if e.type == "in")
            total_out = sum(e.amount for e in entries if e.type == "out")
            cashflow_months.append({
                "month": m.name,
                "money_in": round(total_in, 2),
                "money_out": round(total_out, 2),
                "net": round(total_in - total_out, 2),
            })

        # Current month top categories
        current_month_cats: dict = {}
        if months:
            latest_m = months[0]
            entries = db.query(models.CashflowEntry).filter(
                models.CashflowEntry.month_id == latest_m.id,
                models.CashflowEntry.type == "out",
            ).all()
            for e in entries:
                current_month_cats[e.category] = current_month_cats.get(e.category, 0) + e.amount
            current_month_cats = dict(
                sorted(current_month_cats.items(), key=lambda x: x[1], reverse=True)[:8]
            )

        # ── Latest Bosta report ───────────────────────────────────────────────
        report = (
            db.query(models.BostaReport)
            .filter(models.BostaReport.brand_id == brand_id)
            .order_by(models.BostaReport.uploaded_at.desc())
            .first()
        )
        bosta_summary = None
        top_skus = []
        if report:
            rows = json.loads(report.rows_json or "[]")
            top_skus = sorted(rows, key=lambda r: r.get("total_revenue", 0), reverse=True)[:8]
            top_skus = [{"sku": r["sku"], "name": r.get("name", ""), "revenue": r.get("total_revenue", 0), "qty": r.get("total_quantity", 0)} for r in top_skus]
            bosta_summary = {
                "date_from": report.date_from,
                "date_to": report.date_to,
                "order_count": report.order_count,
                "grand_revenue": report.grand_revenue,
            }

        # ── Stock ─────────────────────────────────────────────────────────────
        prices = (
            db.query(models.StockPurchasePrice)
            .filter(models.StockPurchasePrice.brand_id == brand_id)
            .all()
        )
        stock_summary = {
            "total_skus": len(prices),
            "total_purchase_value": round(sum(p.purchase_price for p in prices), 2),
        }

    return {
        "cashflow_last_6_months": cashflow_months,
        "current_month_top_expense_categories": current_month_cats,
        "latest_bosta_report": bosta_summary,
        "top_8_skus_by_revenue": top_skus,
        "stock_summary": stock_summary,
    }


class AskBody(BaseModel):
    question: str


@router.post("/bi/ask")
def ask_bi(
    body: AskBody,
    brand_id: int = Depends(get_brand_id),
    current_user: models.User = Depends(get_current_user),
):
    if not GEMINI_API_KEY:
        raise HTTPException(400, "GEMINI_API_KEY not configured")

    snapshot = _build_snapshot(brand_id)
    system_prompt = (
        "You are a business intelligence assistant for an e-commerce brand. "
        "Answer only using the provided data snapshot. "
        "If the data is insufficient to answer, say so clearly. "
        "Be concise and actionable."
    )
    user_content = (
        f"Data snapshot:\n{json.dumps(snapshot, indent=2)}\n\n"
        f"Question: {body.question}"
    )

    try:
        resp = httpx.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_content}]}],
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Gemini API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(502, f"Gemini request failed: {e}")

    candidates = data.get("candidates", [])
    if not candidates:
        raise HTTPException(502, "Gemini returned no candidates")
    answer = candidates[0]["content"]["parts"][0]["text"]

    usage = data.get("usageMetadata", {})
    prompt_tokens   = usage.get("promptTokenCount")
    response_tokens = usage.get("candidatesTokenCount")

    with get_db() as db:
        insight = models.BiInsight(
            brand_id        = brand_id,
            user_id         = current_user.id,
            question        = body.question,
            answer          = answer,
            model           = "gemini-1.5-flash",
            prompt_tokens   = prompt_tokens,
            response_tokens = response_tokens,
            created_at      = _dt.utcnow(),
        )
        db.add(insight)
        db.commit()
        db.refresh(insight)
        return {
            "id":         insight.id,
            "answer":     answer,
            "created_at": insight.created_at.isoformat(),
        }


@router.get("/bi/history")
def get_bi_history(
    brand_id: int = Depends(get_brand_id),
    _user: models.User = Depends(get_current_user),
):
    with get_db() as db:
        rows = (
            db.query(models.BiInsight)
            .filter(models.BiInsight.brand_id == brand_id)
            .order_by(models.BiInsight.created_at.desc())
            .limit(50)
            .all()
        )
        return [
            {
                "id":         r.id,
                "question":   r.question,
                "answer":     r.answer,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
