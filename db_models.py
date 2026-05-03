"""
CompeteAI — SQLAlchemy ORM Models (Production)
Extended with keywords, sentiment score, star rating, price,
and buy recommendation for advanced analysis.
"""

import json
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from database import Base


class AnalysisResult(Base):
    """Stores a completed product analysis."""

    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String(2048), nullable=False, index=True)
    product_title = Column(String(512), nullable=False, default="Unknown")
    summary = Column(Text, nullable=False, default="")
    positives_json = Column(Text, nullable=False, default="[]")
    negatives_json = Column(Text, nullable=False, default="[]")
    opportunities_json = Column(Text, nullable=False, default="[]")
    keywords_json = Column(Text, nullable=False, default="[]")
    sentiment_score = Column(Float, nullable=True)          # 0-10 AI sentiment
    buy_recommendation = Column(String(32), nullable=True)  # "buy", "consider", "avoid"
    star_rating = Column(Float, nullable=True)               # Average star rating from page
    price = Column(String(64), nullable=True)                # Price string from page
    product_score = Column(Float, nullable=False, default=0.0)
    verdict = Column(String(64), nullable=False, default="")
    review_count = Column(Integer, nullable=False, default=0)
    warning = Column(String(256), nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # ── Convenience helpers ──────────────────────────────────

    @property
    def positives(self) -> list[str]:
        return json.loads(self.positives_json)

    @property
    def negatives(self) -> list[str]:
        return json.loads(self.negatives_json)

    @property
    def opportunities(self) -> list[str]:
        return json.loads(self.opportunities_json)

    @property
    def keywords(self) -> list[str]:
        try:
            return json.loads(self.keywords_json)
        except (json.JSONDecodeError, TypeError):
            return []

    def to_dict(self) -> dict:
        """Serialize to the API response shape."""
        data = {
            "id": self.id,
            "url": self.url,
            "product_title": self.product_title,
            "summary": self.summary,
            "positives": self.positives,
            "negatives": self.negatives,
            "opportunities": self.opportunities,
            "keywords": self.keywords,
            "sentiment_score": self.sentiment_score,
            "buy_recommendation": self.buy_recommendation,
            "star_rating": self.star_rating,
            "price": self.price,
            "product_score": self.product_score,
            "verdict": self.verdict,
            "review_count": self.review_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if self.warning:
            data["warning"] = self.warning
        return data
