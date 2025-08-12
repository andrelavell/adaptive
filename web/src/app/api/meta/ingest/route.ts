import { NextResponse } from 'next/server';
import { getServerMetaToken } from '@/lib/metaToken';
import { getInsights } from '@/services/meta/client';
import { query as dbQuery } from '@/lib/db';

function pick<T = any>(arr: any[] | undefined, keys: string[]): T | null {
  if (!Array.isArray(arr)) return null;
  for (const k of keys) {
    const found = arr.find((x) => x?.action_type === k);
    if (found) return found as T;
  }
  return null;
}

export async function GET(req: Request) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) return NextResponse.json({ error: 'META_AD_ACCOUNT_ID missing' }, { status: 500 });

  const token = await getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Meta token missing' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get('days') || '21'), 1), 90);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '1000'), 1), 5000);
  const persist = searchParams.get('persist') === '1' || searchParams.get('persist') === 'true';
  const breakdowns = searchParams.get('breakdowns') || '';

  const fields = [
    'ad_id',
    'ad_name',
    'impressions',
    'clicks',
    'spend',
    'ctr',
    'cpm',
    'actions',
    'action_values',
    'purchase_roas',
  ].join(',');

  const since = new Date(Date.now() - days * 86400000);
  const until = new Date();
  const params: any = {
    level: 'ad',
    fields,
    limit,
    time_range: {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    },
    action_attribution_windows: '7d_click,1d_view',
    action_report_time: 'conversion',
  };
  if (breakdowns) params.breakdowns = breakdowns;

  try {
    const data = await getInsights(adAccountId, params, token.access_token);
    const rows = (data?.data || []) as any[];

    const normalized = rows.map((r) => {
      const actions = r.actions || [];
      const action_values = r.action_values || [];
      const purchases = Number((pick(actions, ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']) as any)?.value || 0);
      const purchase_value = Number((pick(action_values, ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']) as any)?.value || 0);
      const impressions = Number(r.impressions || 0);
      const clicks = Number(r.clicks || 0);
      const spend = Number(r.spend || 0);
      const ctrPct = Number(String(r.ctr || 0).replace('%','')) || (impressions ? (clicks / impressions) * 100 : 0);
      const ctr = ctrPct / 100;
      const cpm = Number(r.cpm || 0);

      let roas = 0;
      if (Array.isArray(r.purchase_roas) && r.purchase_roas.length) {
        const pr = pick(r.purchase_roas, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']) as any;
        roas = Number((pr && pr.value) || 0);
        if (!roas) roas = Number((r.purchase_roas[0] as any)?.value || 0);
      } else if (typeof r.purchase_roas === 'number') {
        roas = Number(r.purchase_roas || 0);
      }

      const clicks_s = clicks + 1;
      const purchases_s = purchases + 1e-3;
      const cvr = purchases_s / clicks_s;
      const aov = purchases > 0 ? purchase_value / purchases : 0;
      const rpme_profit = 1000 * ctr * cvr * aov - cpm;
      const score = roas * 1000 + rpme_profit + purchases * 50 + (purchase_value || 0) * 0.1;

      return {
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        impressions,
        clicks,
        spend,
        ctr_pct: ctrPct,
        cpm,
        purchases,
        purchase_value,
        purchase_roas: roas,
        cvr,
        aov,
        rpme_profit,
        score,
      };
    });

    normalized.sort((a, b) => b.score - a.score);

    let persisted = 0;
    let dbStatus: 'ok' | 'skipped' | 'error' = 'skipped';
    if (persist) {
      try {
        const sinceStr = since.toISOString().slice(0, 10);
        const untilStr = until.toISOString().slice(0, 10);
        const batchSize = 200;
        for (let i = 0; i < normalized.length; i += batchSize) {
          const batch = normalized.slice(i, i + batchSize);
          const valuesPlaceholders: string[] = [];
          const params: any[] = [];
          batch.forEach((n, idx) => {
            const base = idx * 11;
            valuesPlaceholders.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11}, NOW())`);
            const roas = n.purchase_roas && n.purchase_roas > 0 ? Number(n.purchase_roas) : (n.spend > 0 ? Number(n.purchase_value) / Number(n.spend) : null);
            params.push(
              'ad',               // scope
              n.ad_id,            // ref_id
              sinceStr,           // window_since
              untilStr,           // window_until
              Number(n.impressions) || 0,
              Number(n.clicks) || 0,
              Number(n.purchases) || 0,
              Number(n.spend) || 0,
              Number(n.purchase_value) || 0,        // revenue
              Number(n.ctr_pct) / 100 || 0,         // ctr as 0..1
              roas === null ? null : Number(roas)   // roas
            );
          });
          const sql = `INSERT INTO performance_metrics (
            scope, ref_id, window_since, window_until,
            impressions, clicks, purchases, spend, revenue, ctr, roas, created_at
          ) VALUES ${valuesPlaceholders.join(',')}`;
          await dbQuery(sql, params);
          persisted += batch.length;
        }
        dbStatus = 'ok';
      } catch (e) {
        dbStatus = 'error';
      }
    }

    return NextResponse.json({
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
      count: rows.length,
      items: normalized.slice(0, 200),
      persist,
      persisted,
      db: dbStatus,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'ingest failed' }, { status: 500 });
  }
}
