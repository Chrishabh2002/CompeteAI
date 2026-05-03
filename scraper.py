"""Amazon product scraper — pulls title, rating, price, reviews."""

import random
import logging
import re
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("competeai.scraper")

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

MAX_REVIEWS = 20
REQUEST_TIMEOUT = 12
MAX_REQUEST_RETRIES = 2


def _get_headers() -> dict:
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }


def _extract_title(soup: BeautifulSoup) -> str:
    tag = soup.find("span", id="productTitle")
    if tag:
        return tag.get_text(strip=True)
    tag = soup.find("h1", id="title")
    if tag:
        span = tag.find("span")
        return span.get_text(strip=True) if span else tag.get_text(strip=True)
    if soup.title:
        return soup.title.get_text(strip=True)
    return "Unknown"


def _extract_star_rating(soup: BeautifulSoup) -> float | None:
    """Extract the average star rating (e.g., 4.3 out of 5)."""
    # Primary: the rating text near the top
    tag = soup.find("span", attrs={"data-hook": "rating-out-of-text"})
    if tag:
        m = re.search(r"([\d.]+)\s*out of", tag.get_text())
        if m:
            return float(m.group(1))

    # Fallback: the star icon's text
    tag = soup.select_one("#acrPopover .a-size-base")
    if tag:
        m = re.search(r"([\d.]+)", tag.get_text())
        if m:
            return float(m.group(1))

    # Fallback: any span containing "out of 5 stars"
    for span in soup.find_all("span", class_="a-icon-alt"):
        text = span.get_text()
        m = re.search(r"([\d.]+)\s*out of\s*5", text)
        if m:
            return float(m.group(1))

    return None


def _extract_price(soup: BeautifulSoup) -> str | None:
    """Extract the product price."""
    # Primary: the main price display
    price_whole = soup.select_one("span.a-price-whole")
    price_frac = soup.select_one("span.a-price-fraction")
    if price_whole:
        whole = price_whole.get_text(strip=True).rstrip(".")
        frac = price_frac.get_text(strip=True) if price_frac else "00"
        sym = soup.select_one("span.a-price-symbol")
        symbol = sym.get_text(strip=True) if sym else "$"
        return f"{symbol}{whole}.{frac}"

    # Fallback: the deal price
    tag = soup.find("span", id="priceblock_dealprice")
    if tag:
        return tag.get_text(strip=True)

    tag = soup.find("span", id="priceblock_ourprice")
    if tag:
        return tag.get_text(strip=True)

    # Fallback: any element with "a-price" class
    price_el = soup.select_one("span.a-price .a-offscreen")
    if price_el:
        return price_el.get_text(strip=True)

    return None


def _extract_reviews(soup: BeautifulSoup) -> list[str]:
    """Collect up to MAX_REVIEWS visible review bodies."""
    reviews: list[str] = []

    # Strategy 1 — review body spans
    review_spans = soup.find_all("span", attrs={"data-hook": "review-body"}, limit=MAX_REVIEWS)
    for span in review_spans:
        inner = span.find("span")
        text = (inner or span).get_text(strip=True)
        if text and len(text) > 10:
            reviews.append(text)
    if reviews:
        return reviews[:MAX_REVIEWS]

    # Strategy 2 — divs with class containing "review-text"
    review_divs = soup.find_all("div", class_=lambda c: c and "review-text" in c, limit=MAX_REVIEWS)
    for div in review_divs:
        text = div.get_text(strip=True)
        if text and len(text) > 10:
            reviews.append(text)
    if reviews:
        return reviews[:MAX_REVIEWS]

    # Strategy 3 — broader CSS selector
    containers = soup.select("div[data-hook='review'] span.review-text-content")
    for el in containers[:MAX_REVIEWS]:
        text = el.get_text(strip=True)
        if text and len(text) > 10:
            reviews.append(text)

    return reviews[:MAX_REVIEWS]


def scrape_amazon_product(url: str) -> dict:
    """
    Scrape an Amazon product page for title, star rating, price, and reviews.
    Returns dict with: product_title, star_rating, price, reviews, error (if any).
    """
    last_error = None

    for attempt in range(1, MAX_REQUEST_RETRIES + 1):
        try:
            logger.info("HTTP GET %s (attempt %d/%d)", url[:80], attempt, MAX_REQUEST_RETRIES)
            response = requests.get(url, headers=_get_headers(), timeout=REQUEST_TIMEOUT)
            response.raise_for_status()

            if "captcha" in response.text.lower() or "robot" in response.text.lower()[:500]:
                logger.warning("CAPTCHA detected (attempt %d)", attempt)
                last_error = "Amazon returned a CAPTCHA page"
                continue

            break
        except requests.RequestException as exc:
            last_error = str(exc)
            logger.warning("Request failed (attempt %d): %s", attempt, exc)
            if attempt == MAX_REQUEST_RETRIES:
                return {"product_title": "Unknown", "reviews": [], "error": f"Request failed: {last_error}"}

    try:
        soup = BeautifulSoup(response.text, "html.parser")
        title = _extract_title(soup)
        star_rating = _extract_star_rating(soup)
        price = _extract_price(soup)
        reviews = _extract_reviews(soup)
    except Exception as exc:
        return {"product_title": "Unknown", "reviews": [], "error": f"Parsing failed: {exc}"}

    logger.info("Scraped: %s | %.1f stars | %s | %d reviews",
                title[:50], star_rating or 0, price or "N/A", len(reviews))

    result = {"product_title": title, "reviews": reviews}
    if star_rating is not None:
        result["star_rating"] = star_rating
    if price is not None:
        result["price"] = price
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = scrape_amazon_product("https://www.amazon.com/dp/B0D5CVSQWJ")
    print(f"Title: {result['product_title']}")
    print(f"Stars: {result.get('star_rating', 'N/A')}")
    print(f"Price: {result.get('price', 'N/A')}")
    print(f"Reviews: {len(result.get('reviews', []))} found")
