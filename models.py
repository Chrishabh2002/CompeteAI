"""
CompeteAI — Pydantic Request / Response Schemas (Production)
"""

from pydantic import BaseModel, Field


# ── Requests ─────────────────────────────────────────────────

class ProductRequest(BaseModel):
    url: str = Field(..., min_length=10, description="Amazon product URL")


class CompareRequest(BaseModel):
    url_a: str = Field(..., min_length=10, description="First Amazon product URL")
    url_b: str = Field(..., min_length=10, description="Second Amazon product URL")


# ── Responses ────────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    id: int
    url: str
    product_title: str
    summary: str
    positives: list[str]
    negatives: list[str]
    opportunities: list[str]
    keywords: list[str] = []
    sentiment_score: float | None = None
    buy_recommendation: str | None = None
    star_rating: float | None = None
    price: str | None = None
    product_score: float
    verdict: str
    review_count: int
    created_at: str | None = None
    warning: str | None = None


class HistoryItem(BaseModel):
    id: int
    product_title: str
    product_score: float
    verdict: str
    review_count: int
    created_at: str | None = None


class ErrorResponse(BaseModel):
    error: str
