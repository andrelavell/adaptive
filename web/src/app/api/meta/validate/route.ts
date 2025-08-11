import { NextResponse } from 'next/server';
import { validateAd } from '@/services/meta/client';
import { getServerMetaToken } from '@/lib/auth';

export async function POST(req: Request) {
  const token = getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Not connected to Meta' }, { status: 401 });

  const adAccountId = process.env.META_AD_ACCOUNT_ID?.replace(/[^0-9]/g, '');
  if (!adAccountId) return NextResponse.json({ error: 'META_AD_ACCOUNT_ID not configured' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {}

  const adsetId = (body.adset_id || '').toString().trim();
  const pageId = (body.page_id || '').toString().trim();
  const link = (body.link_url || 'https://adaptive-psi.vercel.app').toString();
  const message = (body.message || 'Adaptive preflight test').toString();

  // Minimal payload; likely to return validation messages if ids are missing/invalid.
  const payload: any = {
    name: 'Adaptive Preflight Test',
    status: 'PAUSED',
    adset_id: adsetId || undefined,
    creative: {
      object_story_spec: {
        page_id: pageId || undefined,
        link_data: {
          link,
          message,
        },
      },
    },
  };

  try {
    const resp = await validateAd(adAccountId, payload, token);
    return NextResponse.json({ ok: true, resp });
  } catch (e: any) {
    // Return the API error body so user can see recommendations/errors.
    return NextResponse.json({ ok: false, error: e?.message || 'Preflight error' }, { status: 500 });
  }
}
