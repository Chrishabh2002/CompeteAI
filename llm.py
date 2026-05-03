"""
CompeteAI — LLM Review Analyzer (Production)
Extracts structured insights, keywords, sentiment score,
and buy recommendation using OpenRouter free models.
"""

import json, logging, re, time
from openai import OpenAI
from config import settings

logger = logging.getLogger("competeai.llm")

# Ordered fastest → slowest for speed
MODELS = [
    "google/gemma-4-31b-it:free",
    "openrouter/auto",
    "nousresearch/hermes-3-llama-3.1-405b:free",
]
TEMPERATURE = 0.3
MAX_ITEMS = 5
MAX_RETRIES = 1
RETRY_DELAY_SECS = 1
MAX_REVIEW_CHARS = 200
MAX_REVIEWS_TO_LLM = 8
LLM_TIMEOUT = 60

_FALLBACK = {
    "summary": "No reviews available",
    "positives": [], "negatives": [], "opportunities": [],
    "keywords": [], "sentiment_score": 5.0, "buy_recommendation": "consider",
}
_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*\n?(.*?)```", re.DOTALL)
_JSON_OBJECT_RE = re.compile(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", re.DOTALL)


def _build_prompt(product_title: str, reviews: list[str]) -> str:
    # Only send top N reviews to keep prompt small and fast
    selected = reviews[:MAX_REVIEWS_TO_LLM]
    truncated = []
    for i, text in enumerate(selected, 1):
        t = text[:MAX_REVIEW_CHARS] + ("..." if len(text) > MAX_REVIEW_CHARS else "")
        truncated.append(f"[R{i}] {t}")
    reviews_block = "\n".join(truncated)
    return f"""You are a senior product analyst. Analyze the following Amazon product reviews for "{product_title}" and extract structured, actionable insights.

RULES:
- Do NOT hallucinate. Only use information explicitly stated in the reviews.
- Identify PATTERNS across reviews, not individual opinions.
- Keep every insight concise (one sentence max) and non-generic.
- Return at most {MAX_ITEMS} items per list.
- Return valid JSON only. No markdown, no explanation, no extra text.

REVIEWS:
{reviews_block}

Return EXACTLY this JSON structure:
{{
  "summary": "A short 1-2 sentence overview of overall customer sentiment",
  "positives": ["top strengths customers consistently praise"],
  "negatives": ["top complaints customers consistently mention"],
  "opportunities": ["concrete improvements the seller should make"],
  "keywords": ["top 5 most frequently mentioned product aspects/features"],
  "sentiment_score": 7.5,
  "buy_recommendation": "buy"
}}

FIELD RULES:
- keywords: Extract the 5 most discussed product features/aspects (e.g., "battery life", "build quality", "customer support")
- sentiment_score: A number from 0 to 10 representing overall customer satisfaction (0=terrible, 10=excellent)
- buy_recommendation: Must be exactly one of "buy", "consider", or "avoid" based on the overall review patterns"""


def _build_compare_prompt(title_a: str, reviews_a: list[str], title_b: str, reviews_b: list[str]) -> str:
    def fmt(title, reviews):
        items = []
        for i, r in enumerate(reviews[:5], 1):
            items.append(f"[R{i}] {r[:150]}")
        return f'Product: "{title}"\n' + "\n".join(items)

    block_a = fmt(title_a, reviews_a)
    block_b = fmt(title_b, reviews_b)

    return f"""You are a senior product analyst. Compare these two Amazon products based on their customer reviews.

PRODUCT A:
{block_a}

PRODUCT B:
{block_b}

Return valid JSON only with this structure:
{{
  "winner": "A" or "B" or "tie",
  "winner_reason": "One sentence explaining why this product is better overall",
  "comparison": {{
    "quality": {{"winner": "A/B/tie", "note": "brief comparison"}},
    "value": {{"winner": "A/B/tie", "note": "brief comparison"}},
    "reliability": {{"winner": "A/B/tie", "note": "brief comparison"}},
    "user_satisfaction": {{"winner": "A/B/tie", "note": "brief comparison"}}
  }},
  "verdict_a": "One sentence verdict for Product A",
  "verdict_b": "One sentence verdict for Product B"
}}"""


def _get_client() -> OpenAI:
    if not settings.OPENROUTER_API_KEY:
        raise EnvironmentError("OPENROUTER_API_KEY is not set.")
    return OpenAI(base_url=settings.OPENROUTER_BASE_URL, api_key=settings.OPENROUTER_API_KEY)


def _call_llm(client: OpenAI, model: str, prompt: str) -> str:
    response = client.chat.completions.create(
        model=model, temperature=TEMPERATURE,
        timeout=LLM_TIMEOUT,
        messages=[
            {"role": "system", "content": "You are a product review analyst. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("LLM returned empty response")
    return content.strip()


def _extract_json(raw: str) -> str:
    match = _JSON_BLOCK_RE.search(raw)
    if match:
        return match.group(1).strip()
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
        return text.strip()
    match = _JSON_OBJECT_RE.search(text)
    if match:
        return match.group(0)
    return text


def _validate_analysis(result: dict) -> dict:
    validated = {
        "summary": "No summary generated",
        "positives": [], "negatives": [], "opportunities": [],
        "keywords": [], "sentiment_score": 5.0, "buy_recommendation": "consider",
    }
    if isinstance(result.get("summary"), str) and result["summary"].strip():
        validated["summary"] = result["summary"].strip()

    for key in ("positives", "negatives", "opportunities", "keywords"):
        items = result.get(key, [])
        if isinstance(items, list):
            clean = [str(item).strip() for item in items if item and str(item).strip()]
            validated[key] = clean[:MAX_ITEMS]

    # Sentiment score
    try:
        score = float(result.get("sentiment_score", 5.0))
        validated["sentiment_score"] = round(max(0, min(10, score)), 1)
    except (ValueError, TypeError):
        validated["sentiment_score"] = 5.0

    # Buy recommendation
    rec = str(result.get("buy_recommendation", "consider")).lower().strip()
    if rec in ("buy", "consider", "avoid"):
        validated["buy_recommendation"] = rec
    else:
        validated["buy_recommendation"] = "consider"

    return validated


def _parse_llm_response(raw: str) -> dict:
    json_text = _extract_json(raw)
    result = json.loads(json_text)
    return _validate_analysis(result)


def _call_with_retry(prompt: str) -> dict:
    """Call LLM with retry across multiple models. Returns parsed dict."""
    client = _get_client()
    last_error = None

    for model in MODELS:
        delay = RETRY_DELAY_SECS
        for attempt in range(1, MAX_RETRIES + 2):
            try:
                logger.info("LLM call to %s (attempt %d)", model, attempt)
                start = time.perf_counter()
                raw = _call_llm(client, model, prompt)
                elapsed = time.perf_counter() - start
                json_text = _extract_json(raw)
                result = json.loads(json_text)
                logger.info("LLM response from %s in %.2fs", model, elapsed)
                return result
            except json.JSONDecodeError as exc:
                logger.error("Invalid JSON from %s: %s", model, exc)
                last_error = f"Invalid JSON: {exc}"
                break
            except Exception as exc:
                err_str = str(exc)
                last_error = f"LLM error: {exc}"
                if "429" in err_str or "rate" in err_str.lower():
                    logger.warning("Rate-limited on %s, retrying in %ds", model, delay)
                    time.sleep(delay)
                    delay *= 2
                    continue
                if "404" in err_str or "not found" in err_str.lower():
                    logger.warning("Model %s not available", model)
                    break
                logger.error("Error on %s: %s", model, exc)
                break
        logger.warning("Exhausted retries for %s", model)

    raise RuntimeError(last_error or "All models failed")


def analyze_reviews(product_title: str, reviews: list[str]) -> dict:
    """Analyze reviews and return structured insights with keywords, sentiment, and recommendation."""
    if not reviews:
        return _FALLBACK.copy()

    try:
        prompt = _build_prompt(product_title, reviews)
        result = _call_with_retry(prompt)
        return _validate_analysis(result)
    except RuntimeError as exc:
        logger.error("All models failed: %s", exc)
        return {**_FALLBACK, "error": str(exc)}
    except Exception as exc:
        logger.error("Unexpected error: %s", exc)
        return {**_FALLBACK, "error": f"Analysis failed: {exc}"}


def compare_products(title_a: str, reviews_a: list[str], title_b: str, reviews_b: list[str]) -> dict:
    """Compare two products head-to-head using AI analysis."""
    try:
        prompt = _build_compare_prompt(title_a, reviews_a, title_b, reviews_b)
        result = _call_with_retry(prompt)
        return result
    except RuntimeError as exc:
        return {"error": str(exc)}
    except Exception as exc:
        return {"error": f"Comparison failed: {exc}"}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sample = ["Battery life is amazing.", "Screen is gorgeous but speakers are tinny.",
              "Great value for price.", "Runs hot under load.", "Support was unhelpful."]
    print(json.dumps(analyze_reviews("Sample Laptop", sample), indent=2))
