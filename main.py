from pathlib import Path
import logging

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

from fastapi import FastAPI
from fastapi.responses import FileResponse as _FileResponse
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.routers import auth, cashflow, dashboard, products, settings, bosta, bi, sms, meta
from app.stock_alert import run_stock_alert_job
from app.bosta_payout import run_bosta_payout_check
from app.meta_balance_alert import run_meta_balance_alert_job

PROJECT_DIR = Path(__file__).parent
DIST        = PROJECT_DIR / "frontend" / "dist"
INDEX_HTML  = DIST / "index.html"

app = FastAPI(title="EcomHQ")

# ── Stock alert scheduler (09:00 + 18:00 UTC daily) ───────────────────────────
_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler.add_job(run_stock_alert_job,        CronTrigger(minute=0))              # hourly; brands filter by configured times
_scheduler.add_job(run_bosta_payout_check,    CronTrigger(hour="*/4", minute=0))   # every 4 hours
_scheduler.add_job(run_meta_balance_alert_job, CronTrigger(minute="*/10"))          # every 10 mins; sends if balance ≤ threshold
_scheduler.start()

app.include_router(auth.router)
app.include_router(sms.router)      # must be before cashflow (avoids /cashflow/{month} swallowing /cashflow/sms-suggestions)
app.include_router(cashflow.router)
app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(settings.router)
app.include_router(bosta.router)
app.include_router(bi.router)
app.include_router(meta.router)


# ── SPA / static file serving ─────────────────────────────────────────────────

from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str = ""):  # noqa: ARG001
        return _FileResponse(str(INDEX_HTML))
else:
    @app.get("/", response_class=HTMLResponse)
    def serve_dev():
        return HTMLResponse((PROJECT_DIR / "index.html").read_text(encoding="utf-8"))
