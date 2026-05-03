"""Analysis pipeline — scrape, analyze, score, save."""

import json
import logging
import time

from sqlalchemy.orm import Session

from scraper import scrape_amazon_product
from llm import analyze_reviews, compare_products
from db_models import AnalysisResult

logger = logging.getLogger("competeai.agent")

LOW_REVIEW_THRESHOLD = 5


def _calculate_score(analysis: dict, review_count: int) -> tuple[float, str]:
    """
    Calculate a weighted product score based on the analysis.

    Uses both traditional heuristic scoring and the AI sentiment score
    for a blended result.
    """
    negatives = analysis.get("negatives", [])
    positives = analysis.get("positives", [])
    ai_sentiment = analysis.get("sentiment_score", 5.0)

    # Heuristic score
    raw_score = 10.0
    for i, _ in enumerate(negatives):
        raw_score -= 1.8 if i < 2 else 1.2
    if len(positives) >= 4:
        raw_score += 0.5
    if review_count < LOW_REVIEW_THRESHOLD:
        raw_score -= 0.5
    heuristic = max(0, min(10, raw_score))

    # Blend: 40% heuristic + 60% AI sentiment
    blended = (heuristic * 0.4) + (ai_sentiment * 0.6)
    product_score = round(max(0, min(10, blended)), 1)

    # Verdict
    if product_score >= 8:
        verdict = "Strong product"
    elif product_score >= 6:
        verdict = "Above average"
    elif product_score >= 4:
        verdict = "Average product"
    elif product_score >= 2:
        verdict = "Below average"
    else:
        verdict = "Needs improvement"

    return product_score, verdict


def run_analysis(url: str, db: Session) -> dict:
    """Run the full scrape -> analyze -> score -> persist pipeline."""
    pipeline_start = time.perf_counter()

    # Step 1: Scrape
    logger.info("  [1/4] Scraping %s", url[:80])
    try:
        scrape_result = scrape_amazon_product(url)
    except Exception as exc:
        logger.error("Scraper crashed: %s", exc)
        return {"error": f"Scraper crashed: {exc}"}

    if "error" in scrape_result:
        return {"error": f"Scraping failed: {scrape_result['error']}"}

    product_title = scrape_result.get("product_title", "Unknown")
    reviews = scrape_result.get("reviews", [])
    star_rating = scrape_result.get("star_rating")
    price = scrape_result.get("price")

    logger.info("  [1/4] Got %d reviews, %.1f stars, %s",
                len(reviews), star_rating or 0, price or "N/A")

    # Step 2: Analyze
    logger.info("  [2/4] LLM analysis (%d reviews)", len(reviews))
    try:
        analysis = analyze_reviews(product_title, reviews)
    except Exception as exc:
        logger.error("Analysis crashed: %s", exc)
        return {"error": f"Analysis crashed: {exc}"}

    if "error" in analysis:
        return {"error": f"Analysis failed: {analysis['error']}"}

    # Step 3: Score
    product_score, verdict = _calculate_score(analysis, len(reviews))
    warning = None
    if len(reviews) < LOW_REVIEW_THRESHOLD:
        warning = f"Low review sample ({len(reviews)} found) — insights may be less reliable"

    logger.info("  [3/4] Score: %.1f/10 — %s | Sentiment: %.1f | Rec: %s",
                product_score, verdict,
                analysis.get("sentiment_score", 0),
                analysis.get("buy_recommendation", "N/A"))

    # Step 4: Persist
    logger.info("  [4/4] Saving to database")
    try:
        record = AnalysisResult(
            url=url,
            product_title=product_title,
            summary=analysis.get("summary", ""),
            positives_json=json.dumps(analysis.get("positives", [])),
            negatives_json=json.dumps(analysis.get("negatives", [])),
            opportunities_json=json.dumps(analysis.get("opportunities", [])),
            keywords_json=json.dumps(analysis.get("keywords", [])),
            sentiment_score=analysis.get("sentiment_score"),
            buy_recommendation=analysis.get("buy_recommendation"),
            star_rating=star_rating,
            price=price,
            product_score=product_score,
            verdict=verdict,
            review_count=len(reviews),
            warning=warning,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info("  Saved id=%d in %.2fs", record.id, time.perf_counter() - pipeline_start)
        return record.to_dict()
    except Exception as exc:
        db.rollback()
        logger.error("DB save failed: %s", exc)
        return {
            "product_title": product_title,
            "summary": analysis.get("summary", ""),
            "positives": analysis.get("positives", []),
            "negatives": analysis.get("negatives", []),
            "opportunities": analysis.get("opportunities", []),
            "keywords": analysis.get("keywords", []),
            "sentiment_score": analysis.get("sentiment_score"),
            "buy_recommendation": analysis.get("buy_recommendation"),
            "star_rating": star_rating,
            "price": price,
            "review_count": len(reviews),
            "product_score": product_score,
            "verdict": verdict,
            **({"warning": warning} if warning else {}),
        }


def run_comparison(url_a: str, url_b: str, db: Session) -> dict:
    """
    Compare two Amazon products head-to-head.
    Scrapes both, runs individual analyses, then a comparative AI analysis.
    """
    logger.info("Starting comparison: %s vs %s", url_a[:60], url_b[:60])

    # Analyze both products (this also persists them)
    result_a = run_analysis(url_a, db)
    if "error" in result_a:
        return {"error": f"Product A failed: {result_a['error']}"}

    result_b = run_analysis(url_b, db)
    if "error" in result_b:
        return {"error": f"Product B failed: {result_b['error']}"}

    # Run comparative analysis
    logger.info("Running comparative LLM analysis")
    try:
        scrape_a = scrape_amazon_product(url_a)
        scrape_b = scrape_amazon_product(url_b)
        comparison = compare_products(
            result_a.get("product_title", "Product A"),
            scrape_a.get("reviews", []),
            result_b.get("product_title", "Product B"),
            scrape_b.get("reviews", []),
        )
    except Exception as exc:
        logger.error("Comparison LLM failed: %s", exc)
        comparison = {"error": f"Comparison failed: {exc}"}

    return {
        "product_a": result_a,
        "product_b": result_b,
        "comparison": comparison,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    from database import SessionLocal, init_db
    init_db()
    db = SessionLocal()
    try:
        result = run_analysis("https://www.amazon.com/dp/B0D5CVSQWJ", db)
        print(json.dumps(result, indent=2))
    finally:
        db.close()
