from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.routers import auth, cashflow, dashboard, products, settings, bosta, bi, sms
from app.stock_alert import run_stock_alert_job

app = FastAPI(title="EcomHQ")

# ── Stock alert scheduler (09:00 + 18:00 UTC daily) ───────────────────────────
_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler.add_job(run_stock_alert_job, CronTrigger(minute=0))  # checks every hour; brands filter by configured times
_scheduler.start()

app.include_router(auth.router)
app.include_router(cashflow.router)
app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(settings.router)
app.include_router(bosta.router)
app.include_router(bi.router)
app.include_router(sms.router)


# ── SPA / static file serving ─────────────────────────────────────────────────

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

PROJECT_DIR = Path(__file__).parent
DIST = PROJECT_DIR / "frontend" / "dist"

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str = ""):  # noqa: ARG001
        return FileResponse(str(DIST / "index.html"))
else:
    @app.get("/", response_class=HTMLResponse)
    def serve_dev():
        return HTMLResponse((PROJECT_DIR / "index.html").read_text(encoding="utf-8"))
