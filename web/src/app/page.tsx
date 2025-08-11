"use client";

import { useEffect, useState } from 'react';

export default function Home() {
  const [lookback, setLookback] = useState(21);
  const [dailyCap, setDailyCap] = useState(8);
  const [similarity, setSimilarity] = useState(0.7);
  const [autoPublish, setAutoPublish] = useState(false);
  const [metaConnected, setMetaConnected] = useState<null | boolean>(null);
  const [metaExpiresAt, setMetaExpiresAt] = useState<string | null>(null);

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
    </div>
  );
}
