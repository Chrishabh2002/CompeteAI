"""Main app entry point."""

import csv
import io
import logging
import os
import threading
import time
from contextlib import asynccontextmanager

import requests as http_requests
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from config import settings
from database import get_db, init_db
from db_models import AnalysisResult
from models import ProductRequest, CompareRequest
from agent import run_analysis, run_comparison

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [%(name)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("competeai")


# Keep-alive pinger (prevents Render free tier sleep)

KEEP_ALIVE_INTERVAL = 14 * 60  # 14 minutes in seconds
_keep_alive_stop = threading.Event()


def _keep_alive_worker():
    render_url = os.environ.get("RENDER_EXTERNAL_URL", "")
    if not render_url:
        logger.info("RENDER_EXTERNAL_URL not set — keep-alive disabled (local dev)")
        return

    health_url = f"{render_url}/health"
    logger.info("Keep-alive started → pinging %s every %ds", health_url, KEEP_ALIVE_INTERVAL)

    # let the server start up first
    _keep_alive_stop.wait(30)

    while not _keep_alive_stop.is_set():
        try:
            resp = http_requests.get(health_url, timeout=10)
            logger.info("Keep-alive ping → %s (status %d)", health_url, resp.status_code)
        except Exception as exc:
            logger.warning("Keep-alive ping failed: %s", exc)
        _keep_alive_stop.wait(KEEP_ALIVE_INTERVAL)

    logger.info("Keep-alive stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CompeteAI Backend Starting")
    init_db()
    logger.info("Database ready")
    logger.info("CORS: %s", settings.CORS_ORIGINS)


    _keep_alive_stop.clear()
    keep_alive_thread = threading.Thread(target=_keep_alive_worker, daemon=True, name="keep-alive")
    keep_alive_thread.start()

    logger.info("CompeteAI Backend Ready (v3.0)")
    yield


    _keep_alive_stop.set()
    logger.info("CompeteAI Backend Shutting Down")


app = FastAPI(
    title="CompeteAI",
    description="AI-powered competitive product analysis",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{time.perf_counter() - start:.3f}s"
    return response


@app.exception_handler(Exception)
async def global_exc_handler(request: Request, exc: Exception):
    logger.error("Unhandled: %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"error": str(exc) if settings.DEBUG else "Internal error"})


# --- routes ---

@app.get("/")
def root():
    return {"status": "ok", "service": "CompeteAI", "version": "3.0.0"}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):

    from sqlalchemy import text as sa_text
    checks = {"database": "healthy", "api": "healthy"}
    try:
        db.execute(sa_text("SELECT 1"))
    except Exception as exc:
        checks["database"] = f"unhealthy: {exc}"
    overall = "healthy" if all(v == "healthy" for v in checks.values()) else "degraded"
    return {"status": overall, "service": "CompeteAI", "version": "3.0.0", "checks": checks}


@app.post("/analyze")
def analyze(request: ProductRequest, db: Session = Depends(get_db)):

    logger.info("Analyze: %s", request.url)
    result = run_analysis(request.url, db)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return result




@app.post("/compare")
def compare(request: CompareRequest, db: Session = Depends(get_db)):

    logger.info("Compare: %s vs %s", request.url_a[:60], request.url_b[:60])
    result = run_comparison(request.url_a, request.url_b, db)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return result


# --- history & search ---

@app.get("/history")
def get_history(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):

    limit = min(limit, 100)
    rows = (
        db.query(AnalysisResult)
        .order_by(AnalysisResult.created_at.desc())
        .offset(offset).limit(limit).all()
    )
    return [
        {
            "id": r.id,
            "url": r.url,
            "product_title": r.product_title,
            "product_score": r.product_score,
            "verdict": r.verdict,
            "review_count": r.review_count,
            "buy_recommendation": r.buy_recommendation,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@app.get("/search")
def search_history(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Search past analyses by product title."""
    rows = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.product_title.ilike(f"%{q}%"))
        .order_by(AnalysisResult.created_at.desc())
        .limit(min(limit, 50))
        .all()
    )
    return [
        {
            "id": r.id,
            "product_title": r.product_title,
            "product_score": r.product_score,
            "verdict": r.verdict,
            "review_count": r.review_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]




@app.get("/analysis/{analysis_id}")
def get_analysis(analysis_id: int, db: Session = Depends(get_db)):

    record = db.query(AnalysisResult).filter(AnalysisResult.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return record.to_dict()


@app.delete("/analysis/{analysis_id}")
def delete_analysis(analysis_id: int, db: Session = Depends(get_db)):

    record = db.query(AnalysisResult).filter(AnalysisResult.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(record)
    db.commit()
    logger.info("Deleted analysis id=%d", analysis_id)
    return {"status": "deleted", "id": analysis_id}




@app.post("/reanalyze/{analysis_id}")
def reanalyze(analysis_id: int, db: Session = Depends(get_db)):

    old = db.query(AnalysisResult).filter(AnalysisResult.id == analysis_id).first()
    if not old:
        raise HTTPException(status_code=404, detail="Original analysis not found")

    logger.info("Re-analyzing id=%d url=%s", analysis_id, old.url)
    result = run_analysis(old.url, db)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return result




@app.get("/analysis/{analysis_id}/export")
def export_analysis(analysis_id: int, db: Session = Depends(get_db)):

    record = db.query(AnalysisResult).filter(AnalysisResult.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    data = record.to_dict()
    output = io.StringIO()
    writer = csv.writer(output)


    writer.writerow(["Field", "Value"])
    writer.writerow(["Product", data["product_title"]])
    writer.writerow(["URL", data["url"]])
    writer.writerow(["Score", data["product_score"]])
    writer.writerow(["Verdict", data["verdict"]])
    writer.writerow(["Sentiment", data.get("sentiment_score", "N/A")])
    writer.writerow(["Recommendation", data.get("buy_recommendation", "N/A")])
    writer.writerow(["Star Rating", data.get("star_rating", "N/A")])
    writer.writerow(["Price", data.get("price", "N/A")])
    writer.writerow(["Reviews Analyzed", data["review_count"]])
    writer.writerow(["Summary", data["summary"]])
    writer.writerow([])
    writer.writerow(["Strengths"])
    for item in data.get("positives", []):
        writer.writerow(["", item])
    writer.writerow(["Weaknesses"])
    for item in data.get("negatives", []):
        writer.writerow(["", item])
    writer.writerow(["Opportunities"])
    for item in data.get("opportunities", []):
        writer.writerow(["", item])
    writer.writerow(["Keywords"])
    for item in data.get("keywords", []):
        writer.writerow(["", item])

    output.seek(0)
    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in data["product_title"])[:50]
    filename = f"CompeteAI_{safe_title}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )




@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):

    from sqlalchemy import func

    total = db.query(func.count(AnalysisResult.id)).scalar() or 0
    avg_score = db.query(func.avg(AnalysisResult.product_score)).scalar()
    avg_sentiment = db.query(func.avg(AnalysisResult.sentiment_score)).scalar()
    total_reviews = db.query(func.sum(AnalysisResult.review_count)).scalar() or 0

    verdict_counts = (
        db.query(AnalysisResult.verdict, func.count(AnalysisResult.id))
        .group_by(AnalysisResult.verdict).all()
    )
    rec_counts = (
        db.query(AnalysisResult.buy_recommendation, func.count(AnalysisResult.id))
        .filter(AnalysisResult.buy_recommendation.isnot(None))
        .group_by(AnalysisResult.buy_recommendation).all()
    )


    top_products = (
        db.query(AnalysisResult.product_title, AnalysisResult.product_score)
        .order_by(AnalysisResult.product_score.desc())
        .limit(5).all()
    )

    return {
        "total_analyses": total,
        "average_score": round(avg_score, 1) if avg_score else 0,
        "average_sentiment": round(avg_sentiment, 1) if avg_sentiment else 0,
        "total_reviews_analyzed": total_reviews,
        "verdict_breakdown": {v: c for v, c in verdict_counts},
        "recommendation_breakdown": {r: c for r, c in rec_counts if r},
        "top_products": [{"title": t, "score": s} for t, s in top_products],
    }
