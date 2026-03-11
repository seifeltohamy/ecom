# SKU Sales Summary App

## What it does
Upload a Bosta inventory Excel export → get a sales summary by SKU.
Store SKU → product name mappings. Add new products via UI.

## Stack
- **Backend**: FastAPI (Python)
- **Frontend**: Single HTML file (vanilla JS, no framework)
- **Storage**: `products.json` (simple key-value SKU → name)

## Directory layout
```
sku-app/
├── plan.md
├── main.py          ← FastAPI backend
├── products.json    ← persisted SKU/name store (auto-created)
├── index.html       ← frontend (served by FastAPI)
└── requirements.txt
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve index.html |
| POST | `/upload` | Upload Excel, parse Description column, return sales report |
| GET | `/products` | List all stored products (SKU → name) |
| POST | `/products` | Add/update a product `{sku, name}` |

## Core logic (adapted from sku_sales_summary.py)
- Read Excel with `openpyxl`
- Extract text from the `Description` column
- Apply regex: `BostaSKU:(BO-\d+)\s*-\s*quantity:(\d+)\s*-\s*itemPrice:([\d.]+)`
- Aggregate by SKU + price → quantity & total
- Merge with stored product names for the report

## Steps
1. [ ] Write `requirements.txt`
2. [ ] Write `main.py` (FastAPI backend)
3. [ ] Write `index.html` (upload form + products table + add product form)
4. [ ] Install deps & test
