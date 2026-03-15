# Stage 1 — Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2 — Python runtime
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium
COPY main.py ./
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist
COPY automation/bosta_daily.py ./automation/bosta_daily.py
COPY start_prod.sh ./
RUN chmod +x start_prod.sh
ENV PORT=8000
EXPOSE $PORT
CMD ["./start_prod.sh"]
