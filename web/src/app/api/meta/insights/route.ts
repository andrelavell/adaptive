import { NextResponse } from 'next/server';
import { getInsights } from '@/services/meta/client';
import { getServerMetaToken } from '@/lib/auth';

export async function GET(req: Request) {
  const token = getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Not connected to Meta' }, { status: 401 });

  const adAccountId = process.env.META_AD_ACCOUNT_ID?.replace(/[^0-9]/g, '');
  if (!adAccountId) return NextResponse.json({ error: 'META_AD_ACCOUNT_ID not configured' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const days = Math.max(1, Math.min(60, Number(searchParams.get('days') || 21)));
  const until = new Date();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const params: Record<string, any> = {
    level: 'ad',
    fields: [
      'ad_id',
      'ad_name',
      'impressions',
      'clicks',
      'spend',
      'cpm',
      'ctr',
      'actions',
    ].join(','),
    breakdowns: ['publisher_platform'].join(','),
    time_range: { since: fmt(since), until: fmt(until) },
    limit: 200,
  };

  try {
    const data = await getInsights(adAccountId, params, token);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Insights error' }, { status: 500 });
  }
}
