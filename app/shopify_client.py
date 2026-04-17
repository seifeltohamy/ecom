"""
shopify_client.py — Shopify Admin API inventory fetcher.

Returns normalized product list matching the shape used by GET /stock-value,
so the same purchase-price / sell-through logic works for both Bosta and Shopify.
"""

import httpx

API_VERSION = "2024-01"


def _normalize_store(store_url: str) -> str:
    """Normalize store URL to https://{store}.myshopify.com"""
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
    return f"https://{store}"


def _shopify_get(url: str, headers: dict, timeout: int = 20) -> httpx.Response:
    """GET with standard error handling for Shopify API calls."""
    try:
        resp = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
    except httpx.ConnectError as e:
        raise ValueError(
            f"Could not reach Shopify store. "
            "Check the Store URL in Settings — it should be like 'mystore.myshopify.com'."
        ) from e
    if resp.status_code == 401:
        raise ValueError("Shopify authentication failed. Check your Admin API access token.")
    if resp.status_code == 404:
        raise ValueError("Shopify resource not found. Verify the store URL.")
    if resp.status_code != 200:
        raise ValueError(f"Shopify API returned {resp.status_code}: {resp.text[:300]}")
    return resp


def _find_chainz_location(store: str, headers: dict) -> int | None:
    """Find the Shopify location ID whose name contains 'chainz' (case-insensitive)."""
    resp = _shopify_get(f"{store}/admin/api/{API_VERSION}/locations.json", headers)
    for loc in resp.json().get("locations", []):
        if "chainz" in (loc.get("name") or "").lower():
            return loc["id"]
    return None


def _get_inventory_levels(store: str, headers: dict, location_id: int) -> dict[int, int]:
    """Fetch inventory levels for a specific location. Returns {inventory_item_id: available}."""
    levels: dict[int, int] = {}
    url = f"{store}/admin/api/{API_VERSION}/inventory_levels.json?location_ids={location_id}&limit=250"
    while url:
        resp = _shopify_get(url, headers)
        for lvl in resp.json().get("inventory_levels", []):
            levels[lvl["inventory_item_id"]] = lvl.get("available", 0) or 0
        url = _next_page_url(resp.headers.get("link", ""))
    return levels


def get_inventory(store_url: str, access_token: str) -> list[dict]:
    """Fetch all products with inventory from Shopify Admin API.

    Automatically detects if a 'Chainz' location exists and scopes inventory
    to that location. Otherwise uses total inventory_quantity across all locations.

    Returns list of dicts with keys matching the Bosta product shape:
      product_code, name, list_price, qty_available, virtual_available
    """
    store = _normalize_store(store_url)
    headers = {"X-Shopify-Access-Token": access_token}

    # Try to find Chainz location for location-scoped inventory
    chainz_loc_id = _find_chainz_location(store, headers)
    inv_levels: dict[int, int] = {}
    if chainz_loc_id:
        inv_levels = _get_inventory_levels(store, headers, chainz_loc_id)

    products: list[dict] = []
    url = f"{store}/admin/api/{API_VERSION}/products.json?limit=250"

    while url:
        resp = _shopify_get(url, headers)

        data = resp.json()
        for product in data.get("products", []):
            title = product.get("title", "Unknown")
            for variant in product.get("variants", []):
                sku = (variant.get("sku") or "").strip()
                if not sku:
                    continue
                variant_title = variant.get("title", "")
                name = title if variant_title in ("Default Title", "") else f"{title} — {variant_title}"

                # Use Chainz location inventory if available, else total
                if chainz_loc_id and inv_levels:
                    inv_item_id = variant.get("inventory_item_id")
                    qty = inv_levels.get(inv_item_id, 0) if inv_item_id else 0
                else:
                    qty = variant.get("inventory_quantity", 0) or 0

                products.append({
                    "product_code": sku,
                    "name": name,
                    "list_price": float(variant.get("price", 0) or 0),
                    "qty_available": qty,
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


def get_product_names_by_sku(store_url: str, access_token: str) -> dict[str, str]:
    """Fetch all Shopify products and return {sku: display_name} mapping."""
    products = get_inventory(store_url, access_token)
    return {p["product_code"]: p["name"] for p in products if p.get("product_code")}


def get_orders_by_name(store_url: str, access_token: str, order_names: list[str]) -> dict:
    """Fetch Shopify orders by name (e.g. '#6656') and return per-order line-item price lookup.

    Returns: {order_name: {sku: float_price}}
    Uses GET /admin/api/{API_VERSION}/orders.json?name=... (batch up to 250).
    Requires `read_orders` scope on the Shopify access token.
    """
    store = _normalize_store(store_url)
    headers = {"X-Shopify-Access-Token": access_token}
    lookup: dict[str, dict[str, float]] = {}

    # Batch in groups of 50 (Shopify name param supports comma-separated)
    batch_size = 50
    for i in range(0, len(order_names), batch_size):
        batch = order_names[i:i + batch_size]
        names_param = ",".join(batch)
        url = f"{store}/admin/api/{API_VERSION}/orders.json?name={names_param}&status=any&limit=250&fields=name,line_items"
        try:
            resp = _shopify_get(url, headers, timeout=30)
        except ValueError:
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
