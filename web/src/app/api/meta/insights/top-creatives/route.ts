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
  const days = Math.min(Math.max(Number(searchParams.get('days') || '7'), 1), 90);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '500'), 1), 5000);

  const fields = [
    'ad_id',
    'ad_name',
    'impressions',
    'clicks',
    'spend',
    'ctr',
    'cpc',
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
  // Favor conversion-based reporting
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
      const ctr = Number(String(r.ctr || 0).replace('%','')) || (impressions ? (clicks / impressions) * 100 : 0);
      const cpm = Number(r.cpm || 0);
      const cpc = Number(r.cpc || 0);
      // purchase_roas may be a number or an array of {action_type, value}
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
      // Derive effective purchase value if action_values missing
      const derived_purchase_value = purchase_value > 0 ? purchase_value : (spend > 0 && roas > 0 ? roas * spend : 0);
      const profit = derived_purchase_value - spend; // revenue - spend
      const spend_weight = Math.max(1, Math.log10(1 + spend)); // 1 .. ~4 for very large spend

      // Score emphasizes profit at meaningful spend; purchases as secondary; small ROAS tie-breaker
      // This de-emphasizes low-spend outliers with high ROAS but negligible volume.
      const score = profit * spend_weight + purchases * 1000 + roas * 50 + ctr * 0.1;
      return {
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        impressions,
        clicks,
        ctr,
        spend,
        cpm,
        cpc,
        purchases,
        purchase_value: derived_purchase_value,
        purchase_roas: roas,
        profit,
        spend_weight,
        score,
      };
    });

    mapped.sort((a, b) => b.score - a.score);
    const top = mapped.slice(0, 50);
    return NextResponse.json({
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
      count: rows.length,
      top,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'top creatives failed' }, { status: 500 });
  }
}
