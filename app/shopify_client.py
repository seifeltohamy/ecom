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
    if store.startswith("http://") or store.startswith("https://"):
        store = store.split("://", 1)[1]
    if "/" in store:
        store = store.split("/", 1)[0]
    if not store.endswith(".myshopify.com"):
        raise ValueError(
            f"Invalid Shopify store URL: '{store_url}'. "
            "Must be your store's .myshopify.com domain (e.g. 'mystore.myshopify.com'), "
            "not the Partner Dashboard or a custom domain."
        )
    store = f"https://{store}"

    headers = {"X-Shopify-Access-Token": access_token}
    products: list[dict] = []
    url = f"{store}/admin/api/{API_VERSION}/products.json?limit=250"

    while url:
        try:
            resp = httpx.get(url, headers=headers, timeout=20, follow_redirects=True)
        except httpx.ConnectError as e:
            raise ValueError(
                f"Could not reach Shopify store '{store}'. "
                "Check the Store URL in Settings — it should be like 'mystore.myshopify.com'."
            ) from e
        if resp.status_code == 401:
            raise ValueError("Shopify authentication failed. Check your Admin API access token (starts with 'shpat_').")
        if resp.status_code == 404:
            raise ValueError(f"Shopify store '{store}' not found. Verify the store URL.")
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


def get_orders_by_name(store_url: str, access_token: str, order_names: list[str]) -> dict:
    """Fetch Shopify orders by name (e.g. '#6656') and return per-order line-item price lookup.

    Returns: {order_name: {sku: float_price}}
    Uses GET /admin/api/{API_VERSION}/orders.json?name=... (batch up to 250).
    Requires `read_orders` scope on the Shopify access token.
    """
    store = store_url.strip().rstrip("/")
    if store.startswith("http://") or store.startswith("https://"):
        store = store.split("://", 1)[1]
    if "/" in store:
        store = store.split("/", 1)[0]
    store = f"https://{store}"

    headers = {"X-Shopify-Access-Token": access_token}
    lookup: dict[str, dict[str, float]] = {}

    # Batch in groups of 50 (Shopify name param supports comma-separated)
    batch_size = 50
    for i in range(0, len(order_names), batch_size):
        batch = order_names[i:i + batch_size]
        names_param = ",".join(batch)
        url = f"{store}/admin/api/{API_VERSION}/orders.json?name={names_param}&status=any&limit=250&fields=name,line_items"
        try:
            resp = httpx.get(url, headers=headers, timeout=30, follow_redirects=True)
        except httpx.ConnectError:
            break
        if resp.status_code != 200:
            break

        for order in resp.json().get("orders", []):
            name = order.get("name", "")
            sku_prices: dict[str, float] = {}
            for item in order.get("line_items", []):
                sku = (item.get("sku") or "").strip()
                if sku:
                    sku_prices[sku] = float(item.get("price", 0) or 0)
            if sku_prices:
                lookup[name] = sku_prices

    return lookup
