import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

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
  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [urlB, setUrlB] = useState("");
  const [compareResult, setCompareResult] = useState(null);
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    checkHealth();
    fetchHistory();
  }, []);

  async function checkHealth() {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) { const d = await r.json(); setBackendStatus(d.status === "healthy" ? "healthy" : "ok"); }
      else setBackendStatus("error");
    } catch {
      try {
        const r = await fetch(`${API}/`, { signal: AbortSignal.timeout(5000) });
        setBackendStatus(r.ok ? "ok" : "error");
      } catch { setBackendStatus("error"); }
    }
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API}/history`);
      if (r.ok) setHistory(await r.json());
    } catch {} finally { setHistoryLoading(false); }
  }

  const handleAnalyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true); setError(null); setResult(null); setCompareResult(null); setAnalysisTime(null);
    const t0 = Date.now();

    try {
      if (compareMode && urlB.trim()) {
        const r = await fetch(`${API}/compare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url_a: trimmed, url_b: urlB.trim() }),
        });
        const data = await r.json();
        setAnalysisTime(((Date.now() - t0) / 1000).toFixed(1));
        if (!r.ok) setError(data.detail || data.error || "Comparison failed");
        else if (data.error) setError(data.error);
        else { setCompareResult(data); fetchHistory(); }
      } else {
        const r = await fetch(`${API}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  function handleExport(id) {
    window.open(`${API}/analysis/${id}/export`, "_blank");
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try {
      const r = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (r.ok) setSearchResults(await r.json());
    } catch {}
  }

  function handleKeyDown(e) { if (e.key === "Enter") handleAnalyze(); }

  function scoreColor(s) {
    if (s >= 8) return "score-green";
    if (s >= 5) return "score-yellow";
    return "score-red";
  }

  function fmtDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function recColor(rec) {
    if (rec === "buy") return "#a8e6a3";
    if (rec === "avoid") return "#f0a0a0";
    return "#e0d090";
  }

  function StatusDot() {
    const c = { checking: "#666", healthy: "#a8e6a3", ok: "#a8e6a3", error: "#f0a0a0" };
    const l = { checking: "Connecting...", healthy: "Backend Online", ok: "Backend Online", error: "Backend Offline" };
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: c[backendStatus], display: "inline-block",
          boxShadow: (backendStatus === "healthy" || backendStatus === "ok") ? `0 0 8px ${c[backendStatus]}` : "none" }} />
        <span style={{ fontSize: "0.65rem", color: c[backendStatus], letterSpacing: "0.05em", fontWeight: 500 }}>{l[backendStatus]}</span>
      </div>
    );
  }

  return (
    <div className="layout">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle history">
        {sidebarOpen ? "\u2715" : "\u2630"}
      </button>

      {/* ── Sidebar ──────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <h2 className="sidebar-title">History</h2>
        {/* Search */}
        <form onSubmit={handleSearch} style={{ padding: "0 4px 12px", display: "flex", gap: 6 }}>
          <input type="text" placeholder="Search..." value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
            style={{ flex: 1, padding: "8px 10px", fontSize: "0.75rem", background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)", color: "var(--text-primary)", outline: "none" }} />
          <button type="submit" style={{ padding: "8px 12px", fontSize: "0.7rem", background: "var(--bg-surface-hover)",
            border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)", color: "var(--text-secondary)", cursor: "pointer" }}>Go</button>
        </form>

        {historyLoading && <p className="sidebar-hint">Loading...</p>}
        {!historyLoading && history.length === 0 && !searchResults && (
          <p className="sidebar-hint">No analyses yet. Paste an Amazon URL and run your first analysis.</p>
        )}
        <ul className="history-list">
          {(searchResults || history).map(item => (
            <li key={item.id} className="history-item" onClick={() => loadFromHistory(item.id)}>
              <span className="history-title">{item.product_title}</span>
              <div className="history-meta">
                <span className={`history-score ${scoreColor(item.product_score)}`}>{item.product_score}</span>
                <span className="history-date">{fmtDate(item.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
        {searchResults && (
          <button onClick={() => { setSearchResults(null); setSearchQuery(""); }}
            style={{ margin: "12px 8px", padding: "6px 12px", fontSize: "0.7rem", background: "transparent",
              border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)", color: "var(--text-muted)", cursor: "pointer" }}>
            Clear Search
          </button>
        )}
      </aside>

      {/* ── Main ──────────────────────── */}
      <main className="app">
        <header className="header">
          <h1 className="logo">CompeteAI</h1>
          <p className="subtitle">AI-Powered Competitive Intelligence</p>
          <StatusDot />
        </header>

        {/* Mode Toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          <button onClick={() => { setCompareMode(false); setCompareResult(null); }}
            style={{ padding: "6px 18px", fontSize: "0.75rem", fontWeight: 600,
              background: !compareMode ? "var(--accent)" : "transparent",
              color: !compareMode ? "var(--bg-primary)" : "var(--text-muted)",
              border: "1px solid var(--border-medium)", borderRadius: 20, cursor: "pointer",
              transition: "all 0.2s" }}>
            Single Analysis
          </button>
          <button onClick={() => { setCompareMode(true); setResult(null); }}
            style={{ padding: "6px 18px", fontSize: "0.75rem", fontWeight: 600,
              background: compareMode ? "var(--accent)" : "transparent",
              color: compareMode ? "var(--bg-primary)" : "var(--text-muted)",
              border: "1px solid var(--border-medium)", borderRadius: 20, cursor: "pointer",
              transition: "all 0.2s" }}>
            Compare Products
          </button>
        </div>

        {/* Search Bars */}
        <div className="search-bar">
          <input id="url-input" type="text" placeholder={compareMode ? "Product A URL..." : "Paste an Amazon product URL..."}
            value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKeyDown}
            disabled={loading} autoComplete="off" spellCheck="false" />
          {!compareMode && (
            <button id="analyze-btn" onClick={handleAnalyze} disabled={loading || !url.trim()}>
              {loading ? "Analyzing..." : "ANALYZE"}
            </button>
          )}
        </div>
        {compareMode && (
          <div className="search-bar" style={{ marginTop: -28 }}>
            <input type="text" placeholder="Product B URL..." value={urlB}
              onChange={e => setUrlB(e.target.value)} disabled={loading} autoComplete="off" spellCheck="false" />
            <button onClick={handleAnalyze} disabled={loading || !url.trim() || !urlB.trim()}>
              {loading ? "Comparing..." : "COMPARE"}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !result && !compareResult && (
          <p className="empty-state">
            {compareMode
              ? "Paste two Amazon product URLs above to see a head-to-head AI comparison."
              : "Paste an Amazon product URL above to uncover AI-powered insights about customer sentiment, strengths, and opportunities."}
          </p>
        )}

        {loading && <div className="loader"><div className="spinner" /><p>Scraping reviews &amp; running AI analysis</p></div>}
        {error && <div className="error-banner" id="error-message">{error}</div>}

        {/* ── Single Result ──────────── */}
        {result && <ResultCard result={result} analysisTime={analysisTime} scoreColor={scoreColor} fmtDate={fmtDate}
          recColor={recColor} onReanalyze={handleReanalyze} onExport={handleExport} />}

        {/* ── Compare Result ─────────── */}
        {compareResult && (
          <div className="results" id="compare-container">
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 16, color: "var(--accent)" }}>
              Head-to-Head Comparison
            </h2>
            {analysisTime && <p className="analysis-date" style={{ marginBottom: 20 }}>Completed in {analysisTime}s</p>}

            {/* Winner */}
            {compareResult.comparison && (
              <div style={{ background: "var(--bg-glass)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius)",
                padding: "18px 22px", marginBottom: 24, backdropFilter: "blur(12px)" }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em",
                  color: "var(--text-ghost)", marginBottom: 8 }}>Winner</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--positive)", marginBottom: 6 }}>
                  {compareResult.comparison.winner === "A" ? compareResult.product_a?.product_title
                    : compareResult.comparison.winner === "B" ? compareResult.product_b?.product_title : "Tie"}
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{compareResult.comparison.winner_reason}</p>

                {compareResult.comparison.comparison && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                    {Object.entries(compareResult.comparison.comparison).map(([cat, val]) => (
                      <div key={cat} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-xs)", padding: "10px 14px",
                        border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em",
                          color: "var(--text-ghost)", marginBottom: 4 }}>{cat}</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: val.winner === "A" ? "var(--positive)"
                          : val.winner === "B" ? "var(--opportunity)" : "var(--text-secondary)" }}>
                          {val.winner === "tie" ? "Tie" : `Product ${val.winner} wins`}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{val.note}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Side by side scores */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {[compareResult.product_a, compareResult.product_b].map((p, i) => p && (
                <div key={i} style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius)", padding: "16px 20px", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em",
                    color: "var(--text-ghost)", marginBottom: 6 }}>Product {i === 0 ? "A" : "B"}</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 8,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.product_title}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: "1.8rem", fontWeight: 800, color: scoreColor(p.product_score) === "score-green"
                      ? "var(--positive)" : scoreColor(p.product_score) === "score-yellow" ? "var(--opportunity)" : "var(--negative)" }}>
                      {p.product_score}</span>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-ghost)" }}>/ 10</span>
                  </div>
                  {p.buy_recommendation && (
                    <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", fontSize: "0.65rem",
                      fontWeight: 700, textTransform: "uppercase", borderRadius: 12,
                      color: recColor(p.buy_recommendation), border: `1px solid ${recColor(p.buy_recommendation)}30`,
                      background: `${recColor(p.buy_recommendation)}10` }}>
                      {p.buy_recommendation}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


function ResultCard({ result, analysisTime, scoreColor, fmtDate, recColor, onReanalyze, onExport }) {
  return (
    <div className="results" id="results-container">
      <h2 className="product-title">{result.product_title}</h2>
      <div className="results-meta">
        <p className="review-count">Based on <span>{result.review_count}</span> review{result.review_count !== 1 ? "s" : ""}</p>
        {result.created_at && <p className="analysis-date">Analyzed {fmtDate(result.created_at)}</p>}
        {analysisTime && <p className="analysis-date">in {analysisTime}s</p>}
      </div>

      {/* Price & Star Rating bar */}
      {(result.price || result.star_rating != null) && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {result.price && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: "var(--bg-glass)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Price</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>{result.price}</span>
            </div>
          )}
          {result.star_rating != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: "var(--bg-glass)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rating</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--opportunity)" }}>{"★".repeat(Math.round(result.star_rating))} {result.star_rating}</span>
            </div>
          )}
        </div>
      )}

      {/* Score + Recommendation */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div className={`score-badge ${scoreColor(result.product_score)}`} style={{ flex: 1 }}>
          <span className="score-value">{result.product_score}</span>
          <span className="score-max">/ 10</span>
          <span className="verdict">{result.verdict}</span>
        </div>
        {result.buy_recommendation && (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
            padding: "16px 24px", background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius)", backdropFilter: "blur(12px)", minWidth: 120 }}>
            <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.18em",
              color: "var(--text-ghost)", marginBottom: 8 }}>Recommendation</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, textTransform: "uppercase",
              color: recColor(result.buy_recommendation) }}>{result.buy_recommendation}</span>
          </div>
        )}
      </div>

      {/* AI Sentiment */}
      {result.sentiment_score != null && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-ghost)" }}>
              AI Sentiment Score
            </span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>{result.sentiment_score}/10</span>
          </div>
          <div style={{ height: 4, background: "var(--border-subtle)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${result.sentiment_score * 10}%`, borderRadius: 4,
              background: result.sentiment_score >= 7 ? "var(--positive)" : result.sentiment_score >= 4 ? "var(--opportunity)" : "var(--negative)",
              transition: "width 1s cubic-bezier(0.22,1,0.36,1)" }} />
          </div>
        </div>
      )}

      {result.warning && <div className="warning-banner">{result.warning}</div>}

      <KeyInsight result={result} />
      <div className="summary-card">{result.summary}</div>

      {/* Keywords */}
      {result.keywords && result.keywords.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--text-ghost)", marginBottom: 12 }}>Top Keywords</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {result.keywords.map((kw, i) => (
              <span key={i} style={{ padding: "5px 14px", fontSize: "0.78rem", fontWeight: 500,
                background: "var(--bg-surface-hover)", border: "1px solid var(--border-medium)",
                borderRadius: 20, color: "var(--text-secondary)" }}>{kw}</span>
            ))}
          </div>
        </div>
      )}

      <InsightSection className="positives" label="Strengths" emoji="+" items={result.positives} />
      <InsightSection className="negatives" label="Weaknesses" emoji="-" items={result.negatives} />
      <InsightSection className="opportunities" label="Action Plan" emoji=">" items={result.opportunities} />

      {/* Action buttons */}
      {result.id && (
        <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
          <button onClick={() => onReanalyze(result.id)} style={{ padding: "10px 20px", fontSize: "0.78rem",
            fontWeight: 600, background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)", cursor: "pointer",
            transition: "all 0.2s" }}>
            Re-analyze with Fresh Data
          </button>
          <button onClick={() => onExport(result.id)} style={{ padding: "10px 20px", fontSize: "0.78rem",
            fontWeight: 600, background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)", cursor: "pointer",
            transition: "all 0.2s" }}>
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
}


function KeyInsight({ result }) {
  const insight = result.negatives?.[0] || result.opportunities?.[0] || result.positives?.[0] || null;
  if (!insight) return null;
  const label = result.negatives?.[0] ? "Critical Finding" : result.opportunities?.[0] ? "Top Opportunity" : "Top Strength";
  return (
    <div className="key-insight">
      <h3 className="key-insight-label">{label}</h3>
      <p className="key-insight-text">{insight}</p>
    </div>
  );
}


function InsightSection({ className, label, emoji, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`insight-section ${className}`}>
      <h3><span className="dot" />{label}</h3>
      <ul>
        {items.map((item, i) => (
          <li key={i}><span style={{ opacity: 0.4, marginRight: 8 }}>{emoji}</span>{item}</li>
        ))}
      </ul>
    </div>
  );
}


export default App;
