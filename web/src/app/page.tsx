"use client";

import { useEffect, useState } from 'react';

export default function Home() {
  const [lookback, setLookback] = useState(21);
  const [dailyCap, setDailyCap] = useState(8);
  const [similarity, setSimilarity] = useState(0.7);
  const [autoPublish, setAutoPublish] = useState(false);
  const [metaConnected, setMetaConnected] = useState<null | boolean>(null);
  const [metaExpiresAt, setMetaExpiresAt] = useState<string | null>(null);
  const [insights, setInsights] = useState<any[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [capiResp, setCapiResp] = useState<any | null>(null);
  const [preflightResp, setPreflightResp] = useState<any | null>(null);

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

  async function fetchInsights() {
    setInsightsLoading(true);
    setInsights(null);
    try {
      const res = await fetch(`/api/meta/insights?days=${lookback}`);
      const data = await res.json();
      if (data?.data?.data) {
        setInsights(data.data.data);
      } else if (data?.data) {
        setInsights(data.data);
      } else {
        setInsights([]);
      }
    } catch (e) {
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function sendCapiTest() {
    setCapiResp(null);
    try {
      const res = await fetch('/api/meta/capi-test', { method: 'POST' });
      const data = await res.json();
      setCapiResp(data);
    } catch (e) {
      setCapiResp({ ok: false, error: String(e) });
    }
  }

  async function runPreflight() {
    setPreflightResp(null);
    try {
      const res = await fetch('/api/meta/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      setPreflightResp(data);
    } catch (e) {
      setPreflightResp({ ok: false, error: String(e) });
    }
  }

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
        <h2>Insights</h2>
        <div className="row">
          <button className="btn" disabled={!metaConnected || insightsLoading} onClick={fetchInsights}>
            {insightsLoading ? 'Fetching…' : `Fetch last ${lookback}d`}
          </button>
          {insights && <span className="hint">rows: {insights.length}</span>}
        </div>
        {insights && insights.length > 0 && (
          <div className="table">
            <div className="row" style={{ fontWeight: 600 }}>
              <div style={{ flex: 2 }}>Ad</div>
              <div>Platform</div>
              <div>Impr</div>
              <div>Clicks</div>
              <div>CTR</div>
              <div>Spend</div>
            </div>
            {insights.slice(0, 10).map((r: any, i: number) => (
              <div key={i} className="row">
                <div style={{ flex: 2 }}>{r.ad_name || r.ad_id}</div>
                <div>{r.publisher_platform || '-'}</div>
                <div>{r.impressions || 0}</div>
                <div>{r.clicks || 0}</div>
                <div>{r.ctr || 0}</div>
                <div>{r.spend || 0}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Conversions API (Test)</h2>
        <div className="row">
          <button className="btn" disabled={!metaConnected} onClick={sendCapiTest}>Send test Purchase</button>
          {capiResp && (
            <span className="hint" title={JSON.stringify(capiResp)}>
              {capiResp.ok ? 'Sent' : 'Error'}
            </span>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Preflight Validate</h2>
        <div className="row">
          <button className="btn" disabled={!metaConnected} onClick={runPreflight}>Run Preflight</button>
          {preflightResp && (
            <span className="hint" title={JSON.stringify(preflightResp)}>
              {preflightResp.ok ? 'OK' : 'See errors'}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
