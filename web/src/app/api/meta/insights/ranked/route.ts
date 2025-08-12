import { NextResponse } from 'next/server';
import { getServerMetaToken } from '@/lib/metaToken';
import { getInsights } from '@/services/meta/client';

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
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '500'), 1), 5000);

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
  };
  (params as any).action_attribution_windows = '7d_click,1d_view';
  (params as any).action_report_time = 'conversion';

  try {
    const data = await getInsights(adAccountId, params, token.access_token);
    const rows = (data?.data || []) as any[];

    const mapped = rows.map((r) => {
      const actions = r.actions || [];
      const action_values = r.action_values || [];
      const purchases = Number((pick(actions, ['purchase', 'offsite_conversion.fb_pixel_purchase']) as any)?.value || 0);
      const purchase_value = Number((pick(action_values, ['purchase', 'offsite_conversion.fb_pixel_purchase']) as any)?.value || 0);
      const impressions = Number(r.impressions || 0);
      const clicks = Number(r.clicks || 0);
      const spend = Number(r.spend || 0);
      // Prefer numeric CTR; Meta may return string with '%'
      const ctrPct = Number(String(r.ctr || 0).replace('%','')) || (impressions ? (clicks / impressions) * 100 : 0);
      const ctr = ctrPct / 100; // convert to 0..1
      const cpm = Number(r.cpm || 0);

      // Smoothing to avoid div by zero and volatility on tiny samples
      const eps = 1e-6;
      const clicks_s = clicks + 1; // add-one smoothing
      const purchases_s = purchases + 1e-3; // tiny smoothing
      const cvr = purchases_s / clicks_s; // approximate CVR
      const aov = purchases > 0 ? purchase_value / purchases : 0;

      // RPME profit heuristic from memory: 1000*CTR*CVR*AOV - CPM
      const rpme_profit = 1000 * (ctr) * (cvr) * (aov) - cpm;

      // Extract ROAS (can be number or array of {action_type, value})
      let roas = 0;
      if (Array.isArray(r.purchase_roas) && r.purchase_roas.length) {
        const pr = pick(r.purchase_roas, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']) as any;
        roas = Number((pr && pr.value) || 0);
        if (!roas) {
          const first = r.purchase_roas[0] as any;
          roas = Number(first?.value || 0);
        }
      } else if (typeof r.purchase_roas === 'number') {
        roas = Number(r.purchase_roas || 0);
      }

      // Final score emphasizing ROAS and purchases, with RPME as profitability signal
      const score = roas * 1000 + rpme_profit + purchases * 50 + (purchase_value || 0) * 0.1;

      return {
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        impressions,
        clicks,
        purchases,
        purchase_value,
        spend,
        ctr_pct: ctrPct,
        cvr,
        aov,
        cpm,
        rpme_profit,
        purchase_roas: roas,
        score,
      };
    });

    mapped.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
      count: rows.length,
      ranked: mapped.slice(0, 50),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'ranked failed' }, { status: 500 });
  }
}
