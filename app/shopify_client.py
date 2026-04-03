"""
shopify_client.py — Shopify Admin API inventory fetcher.

Returns normalized product list matching the shape used by GET /stock-value,
so the same purchase-price / sell-through logic works for both Bosta and Shopify.
"""

import httpx

API_VERSION = "2024-01"


def get_inventory(store_url: str, access_token: str) -> list[dict]:
    """Fetch all products with inventory from Shopify Admin API.

    Returns list of dicts with keys matching the Bosta product shape:
      product_code, name, list_price, qty_available, virtual_available
    """
    store = store_url.strip().rstrip("/")
    if not store.startswith("http"):
        store = f"https://{store}"

    headers = {"X-Shopify-Access-Token": access_token}
    products: list[dict] = []
    url = f"{store}/admin/api/{API_VERSION}/products.json?limit=250"

    while url:
        resp = httpx.get(url, headers=headers, timeout=20, follow_redirects=True)
        if resp.status_code == 401:
            raise ValueError("Shopify authentication failed. Check your access token.")
        if resp.status_code != 200:
            raise ValueError(f"Shopify API returned {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        for product in data.get("products", []):
            title = product.get("title", "Unknown")
            for variant in product.get("variants", []):
                sku = (variant.get("sku") or "").strip()
                if not sku:
                    continue
                variant_title = variant.get("title", "")
                name = title if variant_title in ("Default Title", "") else f"{title} — {variant_title}"
                products.append({
                    "product_code": sku,
                    "name": name,
                    "list_price": float(variant.get("price", 0) or 0),
                    "qty_available": variant.get("inventory_quantity", 0) or 0,
                    "virtual_available": 0,
                })

        # Cursor-based pagination via Link header
        url = _next_page_url(resp.headers.get("link", ""))

    return products


def _next_page_url(link_header: str) -> str | None:
    """Parse Shopify Link header for the next page URL."""
    if not link_header:
        return None
    for part in link_header.split(","):
        if 'rel="next"' in part:
            url = part.split(";")[0].strip().strip("<>")
            return url
    return None
