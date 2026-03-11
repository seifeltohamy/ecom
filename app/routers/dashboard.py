import json
from fastapi import APIRouter, Depends

from app.deps import get_db, get_current_user, require_admin, get_brand_id
from app import models

router = APIRouter()


@router.get("/dashboard/summary")
def dashboard_summary(month: str = None, brand_id: int = Depends(get_brand_id), _user: models.User = Depends(get_current_user)):
    from datetime import datetime as _dt
    now = _dt.utcnow()
    if month:
        current_month_name = month
        current_year = month.split()[-1] if month.split() else str(now.year)
    else:
        current_month_name = now.strftime("%b %Y")
        current_year = str(now.year)

    with get_db() as db:
        m = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.name == current_month_name,
            models.CashflowMonth.brand_id == brand_id
        ).first()
        this_month_in = this_month_out = 0.0
        if m:
            for e in db.query(models.CashflowEntry).filter(models.CashflowEntry.month_id == m.id).all():
                if e.type == "in":
                    this_month_in  += e.amount
                else:
                    this_month_out += e.amount

        all_months = db.query(models.CashflowMonth).filter(
            models.CashflowMonth.brand_id == brand_id
        ).all()
        ytd_ids = [mm.id for mm in all_months if mm.name.split()[-1] == current_year]
        total_in_ytd = total_out_ytd = 0.0
        if ytd_ids:
            for e in db.query(models.CashflowEntry).filter(models.CashflowEntry.month_id.in_(ytd_ids)).all():
                if e.type == "in":
                    total_in_ytd  += e.amount
                else:
                    total_out_ytd += e.amount

        last_rpt = db.query(models.BostaReport).filter(
            models.BostaReport.brand_id == brand_id
        ).order_by(models.BostaReport.uploaded_at.desc()).first()
        last_report = top_sku = None
        if last_rpt:
            last_report = {
                "uploaded_at": last_rpt.uploaded_at.isoformat(),
                "order_count": last_rpt.order_count,
                "grand_revenue": last_rpt.grand_revenue,
            }
            rows = json.loads(last_rpt.rows_json)
            if rows:
                best = max(rows, key=lambda x: x.get("total_quantity", 0))
                top_sku = {"sku": best["sku"], "name": best["name"], "total_quantity": best["total_quantity"]}

    return {
        "this_month_in":  round(this_month_in,  2),
        "this_month_out": round(this_month_out, 2),
        "this_month_net": round(this_month_in - this_month_out, 2),
        "total_in_ytd":   round(total_in_ytd,   2),
        "total_out_ytd":  round(total_out_ytd,  2),
        "last_report":    last_report,
        "top_sku":        top_sku,
        "current_month":  current_month_name,
    }


@router.get("/admin/overview", tags=["admin"])
def admin_overview(_admin: models.User = Depends(require_admin)):
    from datetime import date
    from sqlalchemy import func

    now = date.today()
    current_month_name = now.strftime("%b %Y")

    with get_db() as db:
        brands = db.query(models.Brand).order_by(models.Brand.created_at).all()
        result = []
        for brand in brands:
            bid = brand.id

            users_count = db.query(func.count(models.User.id)).filter(
                models.User.brand_id == bid
            ).scalar() or 0

            products_count = db.query(func.count(models.Product.sku)).filter(
                models.Product.brand_id == bid
            ).scalar() or 0

            cashflow_months_count = db.query(func.count(models.CashflowMonth.id)).filter(
                models.CashflowMonth.brand_id == bid
            ).scalar() or 0

            cashflow_entries_total = db.query(func.count(models.CashflowEntry.id)).join(
                models.CashflowMonth, models.CashflowEntry.month_id == models.CashflowMonth.id
            ).filter(models.CashflowMonth.brand_id == bid).scalar() or 0

            current_month_in = 0.0
            current_month_out = 0.0
            cur_month = db.query(models.CashflowMonth).filter(
                models.CashflowMonth.brand_id == bid,
                models.CashflowMonth.name == current_month_name,
            ).first()
            if cur_month:
                for row in db.query(models.CashflowEntry).filter(
                    models.CashflowEntry.month_id == cur_month.id
                ).all():
                    if row.type == "in":
                        current_month_in += row.amount
                    else:
                        current_month_out += row.amount

            bosta_reports_count = db.query(func.count(models.BostaReport.id)).filter(
                models.BostaReport.brand_id == bid
            ).scalar() or 0

            last_report = db.query(models.BostaReport).filter(
                models.BostaReport.brand_id == bid
            ).order_by(models.BostaReport.uploaded_at.desc()).first()
            last_report_date = last_report.uploaded_at.strftime("%b %Y") if last_report else None

            result.append({
                "brand_id": bid,
                "brand_name": brand.name,
                "users_count": users_count,
                "products_count": products_count,
                "cashflow_months_count": cashflow_months_count,
                "cashflow_entries_total": cashflow_entries_total,
                "current_month_in": current_month_in,
                "current_month_out": current_month_out,
                "current_month_net": current_month_in - current_month_out,
                "bosta_reports_count": bosta_reports_count,
                "last_report_date": last_report_date,
            })
        return result


@router.get("/admin/brand-settings", tags=["admin"])
def admin_brand_settings(_admin: models.User = Depends(require_admin)):
    KEYS = ("bosta_email", "bosta_password", "bosta_api_key", "bosta_email_password")
    with get_db() as db:
        brands = db.query(models.Brand).order_by(models.Brand.id).all()
        settings_rows = db.query(models.AppSettings).filter(
            models.AppSettings.key.in_(KEYS)
        ).all()

    settings_map: dict[int, dict] = {}
    for row in settings_rows:
        settings_map.setdefault(row.brand_id, {})[row.key] = row.value or ""

    result = []
    for brand in brands:
        cfg = settings_map.get(brand.id, {})
        if not cfg.get("bosta_email"):
            continue
        result.append({
            "brand_id":             brand.id,
            "brand_name":           brand.name,
            "bosta_email":          cfg.get("bosta_email", ""),
            "bosta_password":       cfg.get("bosta_password", ""),
            "bosta_api_key":        cfg.get("bosta_api_key", ""),
            "bosta_email_password": cfg.get("bosta_email_password", ""),
        })
    return result
