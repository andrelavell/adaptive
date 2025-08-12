import { NextResponse } from 'next/server';
import { getServerMetaToken } from '@/lib/metaToken';
import { capiPurchase } from '@/services/meta/client';
import crypto from 'node:crypto';

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function GET(req: Request) {
  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) return NextResponse.json({ error: 'META_PIXEL_ID missing' }, { status: 500 });

  const token = await getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Meta token missing' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const value = Number(searchParams.get('value') || '12.34');
  const currency = searchParams.get('currency') || 'USD';
  const test_event_code = searchParams.get('test_event_code') || undefined;
  const event_source_url = searchParams.get('event_source_url') || process.env.APP_BASE_URL || 'https://example.com';
  const client_user_agent = searchParams.get('ua') || 'Mozilla/5.0';

  const event_id = crypto.randomUUID();
  const event: any = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_source_url,
    action_source: 'website',
    event_id,
    user_data: { client_user_agent },
    custom_data: { value, currency },
  };

  try {
    const resp = await capiPurchase(pixelId, event, token.access_token, test_event_code ? { testEventCode: String(test_event_code) } : undefined);
    return NextResponse.json({ ok: true, response: resp, sent_event_id: event_id, via: 'GET' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'capi failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) return NextResponse.json({ error: 'META_PIXEL_ID missing' }, { status: 500 });

  const token = await getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Meta token missing' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const {
    email,
    value = 12.34,
    currency = 'USD',
    event_source_url = process.env.APP_BASE_URL || 'https://example.com',
    client_user_agent = 'Mozilla/5.0',
    test_event_code,
  } = body || {};

  const event_id = crypto.randomUUID();
  const event: any = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_source_url,
    action_source: 'website',
    event_id,
    user_data: {
      em: email ? [sha256(String(email).trim().toLowerCase())] : undefined,
      client_user_agent,
    },
    custom_data: {
      value: Number(value),
      currency: String(currency),
    },
  };

  try {
    const resp = await capiPurchase(pixelId, event, token.access_token, test_event_code ? { testEventCode: String(test_event_code) } : undefined);
    return NextResponse.json({ ok: true, response: resp, sent_event_id: event_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'capi failed' }, { status: 500 });
  }
}
