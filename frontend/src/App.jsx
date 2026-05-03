import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [analysisTime, setAnalysisTime] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [urlB, setUrlB] = useState("");
  const [compareResult, setCompareResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => { checkHealth(); fetchHistory(); }, []);

  async function checkHealth() {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) { const d = await r.json(); setBackendStatus(d.status === "healthy" ? "online" : "online"); }
      else setBackendStatus("offline");
    } catch {
      try {
        const r = await fetch(`${API}/`, { signal: AbortSignal.timeout(5000) });
        setBackendStatus(r.ok ? "online" : "offline");
      } catch { setBackendStatus("offline"); }
    }
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    try { const r = await fetch(`${API}/history`); if (r.ok) setHistory(await r.json()); }
    catch {} finally { setHistoryLoading(false); }
  }

  const handleAnalyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true); setError(null); setResult(null); setCompareResult(null); setAnalysisTime(null);
    const t0 = Date.now();
    try {
      if (compareMode && urlB.trim()) {
        const r = await fetch(`${API}/compare`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url_a: trimmed, url_b: urlB.trim() }),
        });
        const data = await r.json();
        setAnalysisTime(((Date.now() - t0) / 1000).toFixed(1));
        if (!r.ok) setError(data.detail || data.error || "Comparison failed");
        else if (data.error) setError(data.error);
        else { setCompareResult(data); fetchHistory(); }
      } else {
        const r = await fetch(`${API}/analyze`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await r.json();
        setAnalysisTime(((Date.now() - t0) / 1000).toFixed(1));
        if (!r.ok) setError(data.detail || data.error || "Analysis failed");
        else if (data.error) setError(data.error);
        else { setResult(data); fetchHistory(); }
      }
    } catch { setError("Failed to reach backend. Is the server running?"); }
    finally { setLoading(false); }
  }, [url, urlB, compareMode]);

  async function loadFromHistory(id) {
    setLoading(true); setError(null); setResult(null); setCompareResult(null);
    setSidebarOpen(false); setAnalysisTime(null);
    try {
      const r = await fetch(`${API}/analysis/${id}`);
      if (r.ok) { const d = await r.json(); setResult(d); setUrl(d.url || ""); }
      else setError("Could not load analysis");
    } catch { setError("Failed to reach backend."); }
    finally { setLoading(false); }
  }

  async function handleReanalyze(id) {
    setLoading(true); setError(null); setResult(null); setAnalysisTime(null);
    const t0 = Date.now();
    try {
      const r = await fetch(`${API}/reanalyze/${id}`, { method: "POST" });
      const data = await r.json();
      setAnalysisTime(((Date.now() - t0) / 1000).toFixed(1));
      if (r.ok && !data.error) { setResult(data); fetchHistory(); }
      else setError(data.detail || data.error || "Re-analysis failed");
    } catch { setError("Failed to reach backend."); }
    finally { setLoading(false); }
  }

  function handleExport(id) { window.open(`${API}/analysis/${id}/export`, "_blank"); }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try { const r = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery.trim())}`); if (r.ok) setSearchResults(await r.json()); } catch {}
  }

  function handleKeyDown(e) { if (e.key === "Enter") handleAnalyze(); }
  function scoreClass(s) { if (s >= 8) return "green"; if (s >= 5) return "yellow"; return "red"; }
  function fmtDate(iso) { if (!iso) return ""; return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-logo">
          <div className="nav-logo-icon">AI</div>
          CompeteAI
        </div>
        <div className="nav-search">
          <span className="nav-search-icon">🔍</span>
          <input
            type="text" placeholder="Analyze an Amazon Product URL..."
            value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKeyDown}
            disabled={loading}
          />
        </div>
        <div className="nav-actions">
          <div className="nav-status">
            <span className={`nav-status-dot ${backendStatus}`} />
            {backendStatus === "online" ? "Online" : backendStatus === "checking" ? "..." : "Offline"}
          </div>
          <button className="nav-btn nav-btn-primary" onClick={handleAnalyze} disabled={loading || !url.trim()}>
            {loading ? "⏳" : "⚡"} <span>{loading ? "Analyzing..." : "Analyze"}</span>
          </button>
        </div>
      </nav>

      <div className="layout">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? "✕" : "☰"}
        </button>

        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <h2 className="sidebar-title">Analysis History</h2>
          <form className="sidebar-search" onSubmit={handleSearch}>
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }} />
            <button type="submit">Go</button>
          </form>
          {historyLoading && <p className="sidebar-hint">Loading...</p>}
          {!historyLoading && history.length === 0 && !searchResults && (
            <p className="sidebar-hint">No analyses yet. Paste a URL and run your first analysis.</p>
          )}
          <ul className="history-list">
            {(searchResults || history).map(item => (
              <li key={item.id} className="history-item" onClick={() => loadFromHistory(item.id)}>
                <span className="history-title">{item.product_title}</span>
                <span className="history-url">{item.url || ""}</span>
                <div className="history-meta">
                  <span className={`history-score score-${scoreClass(item.product_score)}`}>{item.product_score}</span>
                  <span className="history-date">{fmtDate(item.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
          {searchResults && (
            <button onClick={() => { setSearchResults(null); setSearchQuery(""); }}
              style={{ margin: "12px 8px", padding: "6px 12px", fontSize: "0.68rem", background: "transparent",
                border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--text-muted)", cursor: "pointer" }}>
              Clear Search
            </button>
          )}
        </aside>

        {/* MAIN */}
        <main className="app">
          {/* Mode toggle */}
          <div className="mode-toggle">
            <button className={`mode-btn ${!compareMode ? "active" : ""}`}
              onClick={() => { setCompareMode(false); setCompareResult(null); }}>
              Single Analysis
            </button>
            <button className={`mode-btn ${compareMode ? "active" : ""}`}
              onClick={() => { setCompareMode(true); setResult(null); }}>
              Compare Products
            </button>
          </div>

          {/* Input bars */}
          <div className="input-bar">
            <input placeholder={compareMode ? "Product A — Amazon URL..." : "Paste an Amazon product URL..."}
              value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKeyDown} disabled={loading} />
            {!compareMode && (
              <button onClick={handleAnalyze} disabled={loading || !url.trim()}>
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            )}
          </div>
          {compareMode && (
            <div className="input-bar" style={{ marginTop: -20 }}>
              <input placeholder="Product B — Amazon URL..." value={urlB}
                onChange={e => setUrlB(e.target.value)} disabled={loading} />
              <button onClick={handleAnalyze} disabled={loading || !url.trim() || !urlB.trim()}>
                {loading ? "Comparing..." : "Compare"}
              </button>
            </div>
          )}

          {/* States */}
          {!loading && !error && !result && !compareResult && (
            <p className="empty-state">
              {compareMode
                ? "Paste two Amazon URLs above to see a head-to-head AI comparison."
                : "Paste an Amazon product URL to uncover AI-powered insights about customer sentiment, strengths, and opportunities."}
            </p>
          )}
          {loading && <div className="loader"><div className="spinner" /><p>Scraping reviews &amp; running AI analysis</p></div>}
          {error && <div className="error-banner">{error}</div>}

          {/* SINGLE RESULT */}
          {result && <ResultCard r={result} time={analysisTime} sc={scoreClass} fmt={fmtDate} onRe={handleReanalyze} onEx={handleExport} />}

          {/* COMPARE RESULT */}
          {compareResult && (
            <CompareView data={compareResult} time={analysisTime} sc={scoreClass} />
          )}
        </main>
      </div>
    </>
  );
}


/* RESULT CARD COMPONENT */
function ResultCard({ r, time, sc, fmt, onRe, onEx }) {
  const cls = sc(r.product_score);
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (r.product_score / 10) * circumference;
  const sentimentPct = r.sentiment_score != null ? Math.round(r.sentiment_score * 10) : 50;
  const negPct = 100 - sentimentPct;

  return (
    <div className="result-container">
      <h2 className="result-header-text">Product Analysis Result</h2>

      {/* Hero: Product + Score */}
      <div className="result-hero">
        <div className="product-info">
          <div className="product-title">{r.product_title}</div>
          {r.price && <div className="product-price">{r.price}</div>}
          <div className="product-meta">
            {r.star_rating != null && (
              <span className="product-meta-tag">
                <span className="star">{"★".repeat(Math.round(r.star_rating))}</span> {r.star_rating}
              </span>
            )}
            <span className="product-meta-tag">📊 {r.review_count} reviews</span>
            {r.created_at && <span className="product-meta-tag">📅 {fmt(r.created_at)}</span>}
            {time && <span className="product-meta-tag">⏱ {time}s</span>}
          </div>
          {r.buy_recommendation && (
            <div style={{ marginTop: 14 }}>
              <span className={`rec-badge ${r.buy_recommendation}`}>{r.buy_recommendation}</span>
            </div>
          )}
        </div>

        {/* Circular gauge */}
        <div className="score-gauge">
          <div className="score-circle">
            <svg viewBox="0 0 128 128">
              <circle className="score-circle-bg" cx="64" cy="64" r="58" />
              <circle className={`score-circle-fill ${cls}`} cx="64" cy="64" r="58"
                strokeDasharray={circumference} strokeDashoffset={offset} />
            </svg>
            <div className="score-inner">
              <span className={`score-number ${cls}`}>{r.product_score}</span>
              <span className="score-of">/ 10</span>
              <div className="score-label">Overall Score</div>
            </div>
          </div>
          <span className={`verdict-badge ${cls}`}>{r.verdict}</span>
        </div>
      </div>

      {/* Sentiment */}
      {r.sentiment_score != null && (
        <div className="card">
          <div className="card-title">Sentiment Analysis</div>
          <div className="sentiment-bar-track">
            <div className="sentiment-bar-fill positive-fill" style={{ width: `${sentimentPct}%` }} />
          </div>
          <div className="sentiment-labels">
            <span className="sentiment-pos">{sentimentPct}% Positive</span>
            <span className="sentiment-neg">{negPct}% Negative</span>
            <span className="sentiment-verdict">
              {sentimentPct >= 70 ? "Positive Sentiment" : sentimentPct >= 40 ? "Mixed Sentiment" : "Negative Sentiment"}
            </span>
          </div>
        </div>
      )}

      {r.warning && <div className="warning-banner">⚠ {r.warning}</div>}

      {/* Summary */}
      <div className="summary-card">{r.summary}</div>

      {/* Strengths + Weaknesses side-by-side */}
      <div className="insights-grid">
        {r.positives?.length > 0 && (
          <div className="insight-card">
            <div className="insight-card-title pos">Key Strengths</div>
            <ul className="insight-list">
              {r.positives.map((item, i) => (
                <li key={i} className="insight-item"><span className="insight-dot green" />{item}</li>
              ))}
            </ul>
          </div>
        )}
        {r.negatives?.length > 0 && (
          <div className="insight-card">
            <div className="insight-card-title neg">Potential Weaknesses</div>
            <ul className="insight-list">
              {r.negatives.map((item, i) => (
                <li key={i} className="insight-item"><span className="insight-dot red" />{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Opportunities */}
      {r.opportunities?.length > 0 && (
        <div className="card">
          <div className="card-title">Action Plan & Opportunities</div>
          <ul className="insight-list">
            {r.opportunities.map((item, i) => (
              <li key={i} className="insight-item"><span className="insight-dot yellow" />{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Keywords */}
      {r.keywords?.length > 0 && (
        <div className="card">
          <div className="card-title">Related Keywords</div>
          <div className="keywords-wrap">
            {r.keywords.map((kw, i) => <span key={i} className="keyword-tag">{kw}</span>)}
          </div>
        </div>
      )}

      {/* Actions */}
      {r.id && (
        <div className="action-row">
          <button className="action-btn" onClick={() => onRe(r.id)}>🔄 Re-analyze</button>
          <button className="action-btn" onClick={() => onEx(r.id)}>📥 Export CSV</button>
        </div>
      )}
    </div>
  );
}


/* COMPARE VIEW — Advanced Head-to-Head */
function CompareView({ data, time, sc }) {
  const { product_a, product_b, comparison } = data;
  const circ = 2 * Math.PI * 44;

  function MiniGauge({ score, size = 100 }) {
    const cls = sc(score);
    const r = 44;
    const c = 2 * Math.PI * r;
    const off = c - (score / 10) * c;
    return (
      <div style={{ width: size, height: size, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
            className={`score-circle-fill ${cls}`}
            strokeDasharray={c} strokeDashoffset={off} />
        </svg>
        <div style={{ textAlign: "center", zIndex: 1 }}>
          <div className={`score-number ${cls}`} style={{ fontSize: "1.6rem" }}>{score}</div>
          <div style={{ fontSize: "0.6rem", color: "var(--text-ghost)" }}>/ 10</div>
        </div>
      </div>
    );
  }

  function SentimentBar({ score, label }) {
    const pct = score != null ? Math.round(score * 10) : 50;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", marginBottom: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>{label}</span>
          <span style={{ color: "var(--positive)", fontWeight: 600 }}>{pct}%</span>
        </div>
        <div style={{ height: 5, background: "var(--border-subtle)", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5,
            background: pct >= 70 ? "var(--positive)" : pct >= 40 ? "var(--opportunity)" : "var(--negative)",
            transition: "width 1s ease" }} />
        </div>
      </div>
    );
  }

  const categories = comparison?.comparison ? Object.entries(comparison.comparison) : [];
  const winnerName = comparison?.winner === "A" ? product_a?.product_title
    : comparison?.winner === "B" ? product_b?.product_title : "Tie";

  return (
    <div className="compare-container">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 className="result-header-text" style={{ marginBottom: 0 }}>⚔️ Head-to-Head Comparison</h2>
        {time && <span className="product-meta-tag">⏱ {time}s</span>}
      </div>

      {/* WINNER BANNER */}
      {comparison && !comparison.error && (
        <div className="cmp-winner-card">
          <div className="cmp-winner-trophy">🏆</div>
          <div className="cmp-winner-body">
            <div className="cmp-winner-label">WINNER</div>
            <div className="cmp-winner-name">{winnerName}</div>
            <div className="cmp-winner-reason">{comparison.winner_reason}</div>
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE SCORE CARDS */}
      <div className="cmp-scores-row">
        {[product_a, product_b].map((p, i) => p && (
          <div key={i} className={`cmp-score-card ${comparison?.winner === (i === 0 ? "A" : "B") ? "cmp-score-winner" : ""}`}>
            <div className="cmp-score-label">Product {i === 0 ? "A" : "B"}</div>
            <div className="cmp-score-title">{p.product_title}</div>
            {p.price && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8 }}>{p.price}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "12px 0" }}>
              <MiniGauge score={p.product_score} />
              <div>
                <div className={`verdict-badge ${sc(p.product_score)}`} style={{ marginBottom: 8 }}>{p.verdict}</div>
                {p.buy_recommendation && <span className={`rec-badge ${p.buy_recommendation}`}>{p.buy_recommendation}</span>}
              </div>
            </div>
            {p.star_rating != null && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <span className="product-meta-tag"><span className="star">{"★".repeat(Math.round(p.star_rating))}</span> {p.star_rating}</span>
                <span className="product-meta-tag">📊 {p.review_count} reviews</span>
              </div>
            )}
            <SentimentBar score={p.sentiment_score} label="Sentiment" />
          </div>
        ))}
      </div>

      {/* VS DIVIDER */}
      <div className="cmp-vs-divider"><span>VS</span></div>

      {/* CATEGORY COMPARISON BARS */}
      {categories.length > 0 && (
        <div className="card">
          <div className="card-title">Category Breakdown</div>
          <div className="cmp-cats">
            {categories.map(([cat, val]) => {
              const isA = val.winner === "A";
              const isB = val.winner === "B";
              const isTie = val.winner === "tie" || val.winner === "Tie";
              return (
                <div key={cat} className="cmp-cat-row">
                  <div className="cmp-cat-header">
                    <span className="cmp-cat-name">{cat.replace(/_/g, " ")}</span>
                    <span className="cmp-cat-badge" style={{
                      color: isA ? "var(--positive)" : isB ? "var(--info)" : "var(--text-muted)",
                      background: isA ? "var(--positive-bg)" : isB ? "var(--info-bg, rgba(96,165,250,0.08))" : "var(--bg-input)",
                      border: `1px solid ${isA ? "var(--positive-border)" : isB ? "rgba(96,165,250,0.18)" : "var(--border-subtle)"}`
                    }}>
                      {isTie ? "TIE" : isA ? "Product A ✓" : "Product B ✓"}
                    </span>
                  </div>
                  <div className="cmp-cat-bar-track">
                    <div className="cmp-cat-bar-a" style={{ width: isA ? "65%" : isTie ? "50%" : "35%",
                      background: isA ? "var(--positive)" : "var(--border-medium)" }} />
                    <div className="cmp-cat-bar-b" style={{ width: isB ? "65%" : isTie ? "50%" : "35%",
                      background: isB ? "var(--info)" : "var(--border-medium)" }} />
                  </div>
                  <div className="cmp-cat-note">{val.note}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE STRENGTHS */}
      <div className="cmp-details-grid">
        {[product_a, product_b].map((p, i) => p && (
          <div key={i} className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ color: i === 0 ? "var(--positive)" : "var(--info)" }}>
              {i === 0 ? "🅰" : "🅱"} {p.product_title?.substring(0, 30)}...
            </div>
            {p.summary && <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>{p.summary}</div>}
            {p.positives?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--positive)", marginBottom: 8 }}>Strengths</div>
                <ul className="insight-list">
                  {p.positives.map((item, j) => <li key={j} className="insight-item"><span className="insight-dot green" />{item}</li>)}
                </ul>
              </div>
            )}
            {p.negatives?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--negative)", marginBottom: 8 }}>Weaknesses</div>
                <ul className="insight-list">
                  {p.negatives.map((item, j) => <li key={j} className="insight-item"><span className="insight-dot red" />{item}</li>)}
                </ul>
              </div>
            )}
            {p.keywords?.length > 0 && (
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>Keywords</div>
                <div className="keywords-wrap">
                  {p.keywords.map((kw, j) => <span key={j} className="keyword-tag">{kw}</span>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* FINAL VERDICTS */}
      {comparison && (comparison.verdict_a || comparison.verdict_b) && (
        <div className="cmp-verdicts-row">
          {[comparison.verdict_a, comparison.verdict_b].map((v, i) => v && (
            <div key={i} className="cmp-verdict-card">
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
                color: i === 0 ? "var(--positive)" : "var(--info)", marginBottom: 8 }}>
                Product {i === 0 ? "A" : "B"} Verdict
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default App;
