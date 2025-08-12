import { NextResponse } from 'next/server';
import { getServerMetaToken } from '@/lib/metaToken';
import { validateAd } from '@/services/meta/client';

export async function POST(req: Request) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) return NextResponse.json({ error: 'META_AD_ACCOUNT_ID missing' }, { status: 500 });

  const token = await getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Meta token missing' }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  try {
    const res = await validateAd(adAccountId, payload, token.access_token);
    return NextResponse.json({ ok: true, response: res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'validate failed' }, { status: 500 });
  }
}
