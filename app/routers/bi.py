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

        # ── Stock purchase prices + sold qty map ─────────────────────────────
        pp_rows = (
            db.query(models.StockPurchasePrice)
            .filter(models.StockPurchasePrice.brand_id == brand_id)
            .all()
        )
        purchase_map = {r.sku: r.purchase_price for r in pp_rows}

        qty_map, report_days = {}, 0
        if report:
            report_rows = json.loads(report.rows_json or "[]")
            qty_map = {r["sku"]: r.get("total_quantity", 0) for r in report_rows}
            if report.date_from and report.date_to:
                from datetime import date as _date
                d0 = _date.fromisoformat(report.date_from)
                d1 = _date.fromisoformat(report.date_to)
                report_days = max(1, (d1 - d0).days + 1)

        # ── Bosta API — live inventory ────────────────────────────────────────
        api_key_row = db.query(models.AppSettings).filter(
            models.AppSettings.key == "bosta_api_key",
            models.AppSettings.brand_id == brand_id,
        ).first()
        bosta_api_key = api_key_row.value if api_key_row else ""

    stock_inventory = []
    if bosta_api_key:
        try:
            products, page, limit = [], 0, 100
            while True:
                resp = httpx.get(
                    "http://app.bosta.co/api/v2/products/fulfillment/list-products",
                    headers={"Authorization": bosta_api_key},
                    params={"page": page, "limit": limit},
                    timeout=15,
                    follow_redirects=True,
                )
                batch = resp.json().get("data", {}).get("data", []) if resp.status_code == 200 else []
                products.extend(batch)
                if len(batch) < limit:
                    break
                page += 1

            for p in products:
                sku           = p.get("product_code") or str(p.get("id", ""))
                on_hand       = p.get("qty_available") or 0
                consumer_price = p.get("list_price") or 0
                purchase_price = purchase_map.get(sku, 0)
                sold          = qty_map.get(sku, 0)
                total_units   = sold + on_hand
                sell_through  = round(sold / total_units * 100, 1) if total_units > 0 else None
                if sold > 0 and report_days > 0:
                    daily = sold / report_days
                    days_remaining = round(on_hand / daily) if daily > 0 else None
                else:
                    days_remaining = None
                stock_inventory.append({
                    "sku": sku,
                    "name": p.get("name") or "",
                    "on_hand": on_hand,
                    "consumer_price": consumer_price,
                    "purchase_price": purchase_price,
                    "consumer_value": round(on_hand * consumer_price, 2),
                    "purchase_value": round(on_hand * purchase_price, 2),
                    "units_sold": sold,
                    "days_remaining": days_remaining,
                    "sell_through_pct": sell_through,
                })
            # Sort by consumer_value desc, keep top 30 to bound context size
            stock_inventory.sort(key=lambda r: r["consumer_value"], reverse=True)
            stock_inventory = stock_inventory[:30]
        except Exception:
            stock_inventory = []

    stock_summary = {
        "total_skus": len(purchase_map),
        "total_purchase_value": round(sum(purchase_map.values()), 2),
        "inventory_note": "Full per-SKU inventory included below" if stock_inventory else "Bosta API unavailable — only totals shown",
    }

    return {
        "cashflow_last_6_months": cashflow_months,
        "current_month_top_expense_categories": current_month_cats,
        "latest_bosta_report": bosta_summary,
        "top_skus_by_revenue": top_skus,
        "stock_summary": stock_summary,
        "stock_inventory_top30": stock_inventory,
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
        "Be concise and actionable. "
        "All monetary values are in Egyptian Pounds (EGP). "
        "Always display amounts with the EGP symbol or suffix (e.g. 149,654 EGP)."
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
