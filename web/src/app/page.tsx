"use client";

import { useEffect, useState } from 'react';

export default function Home() {
  const [lookback, setLookback] = useState(21);
  const [dailyCap, setDailyCap] = useState(8);
  const [similarity, setSimilarity] = useState(0.7);
  const [autoPublish, setAutoPublish] = useState(false);
  const [persistToDb, setPersistToDb] = useState(false);
  const [metaConnected, setMetaConnected] = useState<null | boolean>(null);
  const [metaExpiresAt, setMetaExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/meta/status')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setMetaConnected(!!d.connected);
        setMetaExpiresAt(d.expires_at ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setMetaConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function callApi(path: string) {
    try {
      setLoading(path);
      setError(null);
      setResult(null);
      const r = await fetch(path, { method: 'GET' });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Request failed');
      setResult(data);
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    } finally {
      setLoading(null);
    }
  }

  const fetchInsights = () => callApi(`/api/meta/insights?level=ad&days=${lookback}&limit=200`);
  const fetchTopCreatives = () => callApi(`/api/meta/insights/top-creatives?days=${lookback}`);
  const sendTestPurchase = () => callApi(`/api/meta/capi-test?value=12.34&currency=USD`);
  const fetchRanked = () => callApi(`/api/meta/insights/ranked?days=${lookback}`);
  const ingestNormalize = () => callApi(`/api/meta/ingest?days=${lookback}${persistToDb ? '&persist=1' : ''}`);

  return (
    <div className="stack">
      <section className="card">
        <h2>Connect Meta</h2>
        <p>Authorize ads_read and ads_management to enable insights and publishing.</p>
        {metaConnected === null && (
          <button className="btn" disabled>Checking connection…</button>
        )}
        {metaConnected === false && (
          <a className="btn" href="/api/auth/meta/start">Connect Meta</a>
        )}
        {metaConnected === true && (
          <div className="row" role="status" aria-live="polite">
            <span className="btn" style={{ pointerEvents: 'none', opacity: 0.8 }}>
              ✅ Connected to Meta
            </span>
            {metaExpiresAt && (
              <span className="hint">token expires: {new Date(metaExpiresAt).toLocaleString()}</span>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Defaults</h2>
        <div className="grid">
          <label>
            <span>Lookback (days): {lookback}</span>
            <input type="range" min={7} max={60} value={lookback} onChange={(e) => setLookback(Number(e.target.value))} />
          </label>
          <label>
            <span>Daily cap: {dailyCap}</span>
            <input type="range" min={1} max={24} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} />
          </label>
          <label>
            <span>Similarity: {similarity.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.01} value={similarity} onChange={(e) => setSimilarity(Number(e.target.value))} />
          </label>
        </div>
        <div className="row">
          <span>Publish mode: Drafts by default</span>
          <label className="toggle">
            <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} />
            <span>Auto-publish after preflight</span>
          </label>
        </div>
        <p className="hint">Changes are not persisted yet. OAuth first; then we’ll wire these to the database configs.</p>
      </section>

      <section className="card">
        <h2>Quick Actions</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={fetchInsights} disabled={metaConnected !== true || !!loading}>
            {loading?.startsWith('/api/meta/insights') ? 'Loading…' : 'Fetch Insights'}
          </button>
          <button className="btn" onClick={fetchTopCreatives} disabled={metaConnected !== true || !!loading}>
            {loading?.startsWith('/api/meta/insights/top-creatives') ? 'Loading…' : 'Top Creatives'}
          </button>
          <button className="btn" onClick={fetchRanked} disabled={metaConnected !== true || !!loading}>
            {loading?.startsWith('/api/meta/insights/ranked') ? 'Loading…' : 'Ranked (RPME)'}
          </button>
          <button className="btn" onClick={ingestNormalize} disabled={metaConnected !== true || !!loading}>
            {loading?.startsWith('/api/meta/ingest') ? 'Loading…' : 'Ingest (normalize)'}
          </button>
          <button className="btn" onClick={sendTestPurchase} disabled={metaConnected !== true || !!loading}>
            {loading?.startsWith('/api/meta/capi-test') ? 'Sending…' : 'Send Test Purchase'}
          </button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="toggle">
            <input type="checkbox" checked={persistToDb} onChange={(e) => setPersistToDb(e.target.checked)} />
            <span>Persist to DB on ingest</span>
          </label>
        </div>
        {error && <p className="hint" style={{ color: 'crimson' }}>Error: {error}</p>}
        {result && (
          <pre style={{ maxHeight: 300, overflow: 'auto', background: '#111', color: '#0f0', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
        {metaConnected === false && (
          <p className="hint">Connect Meta first to enable actions.</p>
        )}
      </section>
    </div>
  );
}
