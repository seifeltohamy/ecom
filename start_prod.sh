#!/bin/sh
set -e
echo "Running Alembic migrations..."
python -m alembic upgrade head
echo "Starting FastAPI on port $PORT..."
exec python -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
