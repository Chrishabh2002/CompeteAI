<p align="center">
  <img src="docs/banner.png" alt="CompeteAI Banner" width="100%" />
</p>

<h1 align="center">CompeteAI</h1>

<p align="center">
  <strong>AI-Powered Competitive Intelligence for Amazon Products</strong>
</p>

<p align="center">
  <a href="https://compete-ai-six.vercel.app/" target="_blank"><img src="https://img.shields.io/badge/🔴_LIVE_DEMO-compete--ai--six.vercel.app-00C853?style=for-the-badge&labelColor=000000" alt="Live Demo" /></a>
  <a href="#features"><img src="https://img.shields.io/badge/Features-12+-white?style=for-the-badge&labelColor=000000" alt="Features" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge&labelColor=000000" alt="MIT License" /></a>
</p>

<p align="center">
  <em>Scrape Amazon product reviews → Analyze with AI → Get actionable competitive insights in seconds.</em>
</p>

---

> **🚀 Try it now → [https://compete-ai-six.vercel.app](https://compete-ai-six.vercel.app/)**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [API Reference](#api-reference)
- [Deployment](#deployment)
  - [Backend → Render](#backend--render)
  - [Frontend → Vercel](#frontend--vercel)
- [Environment Variables](#environment-variables)
- [Keep-Alive System](#keep-alive-system)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**CompeteAI** is a full-stack competitive intelligence platform that transforms raw Amazon product reviews into structured, AI-driven insights. Simply paste an Amazon product URL — CompeteAI scrapes the reviews, runs them through advanced LLM analysis, and delivers a comprehensive product scorecard with sentiment analysis, keyword extraction, strengths/weaknesses breakdown, and a clear buy recommendation.

Whether you're a product manager benchmarking competitors, a seller optimizing listings, or a smart shopper making data-driven decisions — CompeteAI gives you the intelligence edge.

### What Makes It Different?

| Traditional Approach | CompeteAI |
|---------------------|-----------|
| Read 100+ reviews manually | AI processes all reviews in seconds |
| Subjective gut feeling | Quantified 0-10 product score |
| No structured data | Keywords, sentiment, SWOT-style breakdown |
| One product at a time | Head-to-head comparison mode |
| No history | Full searchable analysis archive with CSV export |

---

## Features

### 🔍 Core Analysis
- **Smart Scraping** — Extracts product title, star rating, price, and up to 20 reviews with User-Agent rotation, retry logic, and CAPTCHA detection
- **AI Analysis Engine** — Multi-model LLM pipeline (Gemma 4, Hermes 3) with automatic failover across providers
- **Product Scoring** — Blended scoring algorithm (40% heuristic + 60% AI sentiment) generating a 0-10 score with clear verdict labels

### ⚔️ Head-to-Head Comparison
- **Compare Mode** — Analyze two products side by side with category-level breakdowns (quality, value, reliability, satisfaction)
- **Winner Declaration** — AI determines the winner with reasoning across each comparison dimension

### 📊 Advanced Insights
- **Sentiment Score** — AI-generated 0-10 customer satisfaction score
- **Buy Recommendation** — Clear `BUY` / `CONSIDER` / `AVOID` classification
- **Keyword Extraction** — Top 5 most discussed product features/aspects
- **SWOT Breakdown** — Structured strengths, weaknesses, and opportunities

### 🗄️ Data Management
- **Analysis History** — Full paginated history of all past analyses
- **Search** — Find past analyses by product title
- **Re-analyze** — Run fresh analysis on previously analyzed products
- **CSV Export** — Download any analysis as a structured CSV file
- **Statistics Dashboard** — Aggregate analytics across all analyses

### 🛡️ Production-Ready
- **Keep-Alive System** — Self-ping mechanism prevents Render free tier from sleeping
- **Global Error Handling** — Graceful error responses with detailed logging
- **CORS Management** — Dynamic origin detection for multi-platform deployments
- **Request Timing** — Every response includes `X-Process-Time` header

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│                    (React 19 + Vite 8)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                         │
│              Static SPA — React + Vite Build                │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    RENDER (Backend)                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ FastAPI   │→ │ Scraper  │→ │  LLM     │→ │  Database  │  │
│  │ Router    │  │ (BS4)    │  │ Analyzer │  │ (SQLite/   │  │
│  │          │  │          │  │          │  │ SQLAlchemy)│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                    │                        │
│                    ┌───────────────┘                        │
│                    ▼                                        │
│            ┌──────────────┐         ┌──────────────┐        │
│            │  OpenRouter   │         │  Keep-Alive  │        │
│            │  (Gemma 4 /   │         │  Self-Ping   │        │
│            │   Hermes 3)   │         │  (14 min)    │        │
│            └──────────────┘         └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Pipeline Flow

```
Amazon URL → Scraper → Reviews + Metadata → LLM Analysis → Score Calculation → Database → API Response
```

| Stage | Module | Description |
|-------|--------|-------------|
| **1. Scrape** | `scraper.py` | HTTP request with UA rotation, extracts title/price/rating/reviews |
| **2. Analyze** | `llm.py` | Sends reviews to LLM, extracts structured JSON insights |
| **3. Score** | `agent.py` | Blends heuristic + AI scores, determines verdict |
| **4. Persist** | `db_models.py` | Saves to SQLite via SQLAlchemy ORM |
| **5. Respond** | `main.py` | Returns structured JSON to frontend |

---

## Tech Stack

### Backend

| Technology | Purpose |
|-----------|---------|
| **Python 3.11+** | Core runtime |
| **FastAPI** | High-performance async web framework |
| **Uvicorn** | ASGI server |
| **SQLAlchemy 2.0** | ORM & database management |
| **SQLite** | Lightweight persistent database |
| **Pydantic v2** | Data validation & serialization |
| **BeautifulSoup4** | HTML parsing for Amazon scraping |
| **OpenAI SDK** | LLM client (via OpenRouter) |
| **python-dotenv** | Environment variable management |

### Frontend

| Technology | Purpose |
|-----------|---------|
| **React 19** | UI framework |
| **Vite 8** | Build tool & dev server |
| **Vanilla CSS** | Custom styling (no framework) |
| **Inter Font** | Typography (Google Fonts) |

### AI / LLM

| Model | Provider | Role |
|-------|----------|------|
| **Llama 4 Maverick** | Meta (via OpenRouter) | Primary — fastest free model |
| **Gemma 3 27B** | Google (via OpenRouter) | Fallback 1 |
| **Mistral Small 3.1** | Mistral (via OpenRouter) | Fallback 2 |
| **Gemma 4 31B IT** | Google (via OpenRouter) | Fallback 3 |
| **Auto Router** | OpenRouter | Final fallback — auto model selection |

### Infrastructure

| Service | Role |
|---------|------|
| **Render** | Backend hosting (Python web service) |
| **Vercel** | Frontend hosting (static SPA) |
| **OpenRouter** | LLM API gateway |

---

## Project Structure

```
CompeteAI/
│
├── main.py                 # FastAPI application — routes, middleware, keep-alive
├── agent.py                # Analysis pipeline orchestrator (scrape → analyze → score → persist)
├── scraper.py              # Amazon product scraper (title, price, rating, reviews)
├── llm.py                  # LLM integration — multi-model with retry & failover
├── database.py             # SQLAlchemy engine, session, and DB initialization
├── db_models.py            # ORM models (AnalysisResult)
├── models.py               # Pydantic request/response schemas
├── config.py               # Centralized settings from environment variables
├── requirements.txt        # Python dependencies
├── render.yaml             # Render deployment blueprint
├── .env.example            # Environment variable template
├── .gitignore              # Git exclusions
│
├── frontend/               # React + Vite frontend application
│   ├── src/
│   │   ├── App.jsx         # Main application component (all views)
│   │   ├── index.css       # Complete design system (CSS custom properties)
│   │   └── main.jsx        # React entry point
│   ├── public/             # Static assets (favicon, icons)
│   ├── index.html          # HTML entry with SEO meta tags
│   ├── package.json        # Node.js dependencies
│   ├── vite.config.js      # Vite configuration
│   └── vercel.json         # Vercel deployment config
│
└── docs/                   # Documentation assets
    ├── banner.png          # README banner image
    └── screenshot.png      # Application screenshot
```

---

## Getting Started

### Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| **Python** | 3.11+ | `python --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Git** | Any | `git --version` |
| **OpenRouter API Key** | — | [Get free key →](https://openrouter.ai/keys) |

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/Chrishabh2002/CompeteAI.git
cd CompeteAI

# 2. Create a virtual environment (recommended)
python -m venv venv

# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment variables
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux

# 5. Edit .env and add your OpenRouter API key
# OPENROUTER_API_KEY=sk-or-v1-your-key-here

# 6. Start the backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at **http://localhost:8000**

Verify: Visit http://localhost:8000/health — you should see:
```json
{
  "status": "healthy",
  "service": "CompeteAI",
  "version": "3.0.0",
  "checks": { "database": "healthy", "api": "healthy" }
}
```

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install Node.js dependencies
npm install

# 3. Configure the API URL (optional — defaults to http://127.0.0.1:8000)
# Edit frontend/.env:
# VITE_API_URL=http://127.0.0.1:8000

# 4. Start the development server
npm run dev
```

The frontend will be available at **http://localhost:5173**

---

## API Reference

All endpoints return JSON. Base URL: `http://localhost:8000`

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check with DB verification |
| `GET` | `/stats` | Aggregate analytics across all analyses |

### Analysis

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/analyze` | Full scrape → analyze → score pipeline | `{ "url": "https://amazon.com/dp/..." }` |
| `POST` | `/compare` | Head-to-head product comparison | `{ "url_a": "...", "url_b": "..." }` |
| `POST` | `/reanalyze/{id}` | Re-run analysis with fresh data | — |

### History & Search

| Method | Endpoint | Description | Params |
|--------|----------|-------------|--------|
| `GET` | `/history` | Paginated analysis history | `?limit=50&offset=0` |
| `GET` | `/search` | Search analyses by product title | `?q=keyword&limit=20` |

### CRUD & Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analysis/{id}` | Fetch single analysis |
| `DELETE` | `/analysis/{id}` | Delete analysis |
| `GET` | `/analysis/{id}/export` | Download as CSV |

### Example: Analyze a Product

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/dp/B0D5CVSQWJ"}'
```

**Response:**
```json
{
  "id": 1,
  "product_title": "Example Product Name",
  "product_score": 7.8,
  "verdict": "Above average",
  "sentiment_score": 7.5,
  "buy_recommendation": "buy",
  "star_rating": 4.3,
  "price": "$29.99",
  "summary": "Customers consistently praise the build quality...",
  "positives": ["Excellent battery life", "Premium build quality"],
  "negatives": ["Runs hot under heavy load"],
  "opportunities": ["Improve thermal management"],
  "keywords": ["battery life", "build quality", "display"],
  "review_count": 15,
  "created_at": "2026-05-03T16:00:00"
}
```

---

## Deployment

### Backend → Render

1. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/Chrishabh2002/CompeteAI.git
   git branch -M main
   git push -u origin main
   ```

2. **Create Render Web Service**
   - Go to [render.com](https://render.com) → **New** → **Web Service**
   - Connect your GitHub repo
   - Configure:

   | Setting | Value |
   |---------|-------|
   | Name | `competeai-backend` |
   | Runtime | Python 3 |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
   | Instance Type | Free |

3. **Set Environment Variables** — See [Environment Variables](#environment-variables)

4. **Deploy** — Render auto-deploys on every git push

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import your GitHub repo
3. Configure:

   | Setting | Value |
   |---------|-------|
   | Framework | Vite |
   | Root Directory | `frontend` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

4. **Set Environment Variable:**

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://competeai-backend.onrender.com` |

5. **Deploy** — Vercel auto-deploys on every git push

### Post-Deployment Checklist

- [ ] Backend `/health` returns `"healthy"`
- [ ] Frontend status dot shows **"Backend Online"** (green)
- [ ] Set `CORS_ORIGINS` on Render to your Vercel URL
- [ ] Keep-alive logs show pings every 14 minutes

---

## Environment Variables

### Backend (`.env` or Render Dashboard)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | ✅ | — | OpenRouter API key ([get one free](https://openrouter.ai/keys)) |
| `OPENROUTER_BASE_URL` | ❌ | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `DATABASE_URL` | ❌ | `sqlite:///./competeai.db` | SQLAlchemy database URL |
| `HOST` | ❌ | `0.0.0.0` | Server bind address |
| `PORT` | ❌ | `8000` | Server port |
| `DEBUG` | ❌ | `false` | Enable debug logging |
| `CORS_ORIGINS` | ❌ | `localhost:5173,...` | Comma-separated allowed origins |
| `MAX_ANALYSES_PER_MINUTE` | ❌ | `10` | Rate limit threshold |

### Frontend (`.env` or Vercel Dashboard)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | ❌ | `http://127.0.0.1:8000` | Backend API base URL |

---

## Keep-Alive System

Render's free tier puts services to sleep after **15 minutes** of inactivity. CompeteAI includes a built-in solution:

### How It Works

```
Server Start → Background Thread Spawns → Waits 30s (server warmup)
    → Pings /health every 14 minutes → Server never sleeps 💪
```

| Parameter | Value |
|-----------|-------|
| Ping Interval | 14 minutes |
| Target Endpoint | `/health` |
| Activation | Automatic on Render (checks `RENDER_EXTERNAL_URL`) |
| Local Development | Disabled (no self-ping) |
| Thread Type | Daemon (dies with main process) |

### Verify in Logs

In your Render dashboard → **Logs**, you should see:
```
Keep-alive started → pinging https://competeai-backend.onrender.com/health every 840s
Keep-alive ping → https://competeai-backend.onrender.com/health (status 200)
```

---

## Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style and naming conventions
- Add docstrings to all new functions
- Test locally before submitting PRs
- Keep commits atomic and well-described

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ by CompeteAI Team</strong>
  <br />
  <em>Turning customer voices into competitive advantage.</em>
</p>
