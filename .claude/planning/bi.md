# Plan + Implementation Notes — Gemini BI Integration

## Goal
Add a Business Intelligence experience powered by Gemini. Provide a chat-style UI and persist Q/A history per brand. Use a bounded data snapshot for safe, concise answers.

---

## What Was Implemented

### Backend

**Endpoints**
- `POST /bi/ask`
  - Body: `{ question: string }`
  - Builds a bounded data snapshot (cashflow + latest Bosta report + stock summary)
  - Calls Gemini `gemini-2.5-flash` via REST
  - Saves Q/A + token usage in DB
  - Returns `{ id, answer, created_at }`
- `GET /bi/history`
  - Returns latest 50 Q/A entries for the current brand

**Data Snapshot (bounded)**
- Cashflow: current month totals, last 6 months net/in/out, top 8 categories in current month
- Bosta: latest report summary + top 8 SKUs by revenue
- Stock: totals (on_hand, consumer_value, purchase_value, capital_trapped) + top 8 by consumer_value

**Gemini Call**
- REST: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- Env: `GEMINI_API_KEY`
- System prompt: “Answer only from provided data; if insufficient, say so; concise actionable insights.”

**Files**
- `app/routers/bi.py` — all BI logic
- `main.py` — includes `bi.router`

---

### Database

**Migration 0016**
New table `bi_insights`:
```
id, brand_id, user_id, question, answer,
model, prompt_tokens, response_tokens, created_at
```
Indexes: `brand_id`, `created_at`

**Files**
- `alembic/versions/0016_bi_insights.py`
- `app/models.py` → `BiInsight` model

---

### Frontend

**BI page**
`/bi` redesigned to GPT-style:
- Inner split layout: history sidebar + chat panel
- History list (Q/A entries); click to view
- Composer at bottom of chat
- Markdown rendering for assistant answers

**Access**
- `/bi` visible to all users (even viewers with restricted `allowedPages`)

**Files**
- `frontend/src/pages/BI.jsx`
- `frontend/src/index.css`
- `frontend/src/App.jsx` (route + nav label + access exception)

**Dependencies**
- `react-markdown`
- `remark-gfm`

---

## Known Issues / Notes
- Gemini 502 errors usually indicate invalid API key, API not enabled, or billing not set.
- BI history requires migration 0016 to be applied.

---

## Docs Updated
- `.claude/API_contract.md` — BI endpoints
- `.claude/DB_schema.md` — bi_insights table + migration
- `.claude/status.md` — GEMINI_API_KEY
- `.claude/session_handoff.md` — BI integration + UI
- `.claude/checklist.md` — BI item marked done
