from pathlib import Path
import logging
import fcntl
import atexit

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

from app.routers import auth, cashflow, dashboard, products, settings, bosta, reports, automation, cost_items, bi, sms, meta, todo, emails, kpi
from app.stock_alert import run_stock_alert_job
from app.bosta_payout import run_bosta_payout_check
from app.meta_balance_alert import run_meta_balance_alert_job
from app.kpi_reminder import run_kpi_reminder_job

PROJECT_DIR = Path(__file__).parent
DIST        = PROJECT_DIR / "frontend" / "dist"
INDEX_HTML  = DIST / "index.html"

app = FastAPI(title="EcomHQ")


# ── SPA page paths that conflict with API route paths ────────────────────────
# When a browser navigates directly to one of these (full page load, Accept: text/html),
# we must serve index.html — otherwise the API route handler runs and returns 401
# because the browser's navigation request has no Authorization header.
_SPA_PAGE_PATHS = {
    "/settings", "/stock-value", "/products-sold", "/cashflow", "/products",
    "/categories", "/admin", "/bosta", "/analytics", "/bi", "/todo", "/emails",
    "/users", "/home", "/kpi",
}

@app.middleware("http")
async def spa_html_navigation_middleware(request, call_next):
    if request.method == "GET":
        path = request.url.path
        accept = request.headers.get("accept", "")
        is_html_nav = "text/html" in accept
        is_spa_path = path in _SPA_PAGE_PATHS or any(path.startswith(p + "/") for p in _SPA_PAGE_PATHS)
        if is_html_nav and is_spa_path and INDEX_HTML.exists():
            return _FileResponse(
                str(INDEX_HTML),
                headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Vary": "Accept"},
            )
    return await call_next(request)

# ── Scheduler — only one worker should run it (file lock prevents duplicates) ──
_scheduler = None
_scheduler_lock_fh = None

def _try_start_scheduler():
    """Acquire an exclusive non-blocking lock. Only the first worker succeeds."""
    global _scheduler, _scheduler_lock_fh
    lock_path = Path("/tmp/ecomhq_scheduler.lock")
    try:
        fh = open(lock_path, "w")
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _scheduler_lock_fh = fh
    except OSError:
        logging.getLogger(__name__).info("Scheduler lock held by another worker — skipping")
        return

    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(run_stock_alert_job,        CronTrigger(minute=0))             # hourly
    _scheduler.add_job(run_bosta_payout_check,     CronTrigger(hour="*/4", minute=0)) # every 4 hours
    _scheduler.add_job(run_meta_balance_alert_job, CronTrigger(minute="*/10"))         # every 10 mins
    _scheduler.add_job(run_kpi_reminder_job,        CronTrigger(minute=0))             # hourly (checks per-category schedule)
    _scheduler.start()
    logging.getLogger(__name__).info("Scheduler started (this worker holds the lock)")

    def _shutdown():
        if _scheduler and _scheduler.running:
            _scheduler.shutdown(wait=False)
        if _scheduler_lock_fh:
            fcntl.flock(_scheduler_lock_fh, fcntl.LOCK_UN)
            _scheduler_lock_fh.close()
    atexit.register(_shutdown)

_try_start_scheduler()

app.include_router(auth.router)
app.include_router(sms.router)      # must be before cashflow (avoids /cashflow/{month} swallowing /cashflow/sms-suggestions)
app.include_router(todo.router)
app.include_router(cashflow.router)
app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(settings.router)
app.include_router(bosta.router)
app.include_router(reports.router)
app.include_router(automation.router)
app.include_router(cost_items.router)
app.include_router(bi.router)
app.include_router(emails.router)
app.include_router(meta.router)
app.include_router(kpi.router)


# ── SPA / static file serving ─────────────────────────────────────────────────

from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str = ""):  # noqa: ARG001
        return _FileResponse(
            str(INDEX_HTML),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Vary": "Accept"},
        )
else:
    @app.get("/", response_class=HTMLResponse)
    def serve_dev():
        return HTMLResponse((PROJECT_DIR / "index.html").read_text(encoding="utf-8"))
