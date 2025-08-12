import { NextResponse } from 'next/server';
import { getServerMetaToken } from '@/lib/metaToken';
import { getInsights } from '@/services/meta/client';

export async function GET(req: Request) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) return NextResponse.json({ error: 'META_AD_ACCOUNT_ID missing' }, { status: 500 });

  const token = await getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Meta token missing' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let days = Number(searchParams.get('days') || '21');
  if (!Number.isFinite(days) || days <= 0 || days > 90) days = 21;

  const fields = (searchParams.get('fields')?.split(',') ?? [
    'ad_name','ad_id','impressions','clicks','spend','actions','action_values','purchase_roas','ctr','cpc','cpm'
  ]).join(',');

  const level = searchParams.get('level') || 'ad';
  const breakdowns = searchParams.get('breakdowns') || '';
  const limit = Number(searchParams.get('limit') || '1000');
  const datePreset = searchParams.get('date_preset');

  const params: any = { level, fields, limit };
  if (breakdowns) params.breakdowns = breakdowns;
  if (!searchParams.get('action_attribution_windows')) {
    params.action_attribution_windows = '7d_click,1d_view';
  }
  if (!searchParams.get('action_report_time')) {
    params.action_report_time = 'conversion';
  }
  if (datePreset) {
    params.date_preset = datePreset;
  } else {
    const since = new Date(Date.now() - days * 86400000);
    const until = new Date();
    params.time_range = {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    };
  }

  try {
    const data = await getInsights(adAccountId, params, token.access_token);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'insights failed' }, { status: 500 });
  }
}
