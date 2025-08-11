import { NextResponse } from 'next/server';
import { capiPurchase } from '@/services/meta/client';
import { getServerMetaToken } from '@/lib/auth';

export async function POST() {
  const token = getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Not connected to Meta' }, { status: 401 });

  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) return NextResponse.json({ error: 'META_PIXEL_ID not configured' }, { status: 400 });

  // Minimal test purchase event
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: 'https://adaptive-psi.vercel.app',
    custom_data: { value: 1.0, currency: 'USD' },
    user_data: { client_user_agent: 'Adaptive.ai Test', client_ip_address: '127.0.0.1' },
    test_event_code: 'TEST',
  };

  try {
    const resp = await capiPurchase(pixelId, event, token);
    return NextResponse.json({ ok: true, resp });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'CAPI error' }, { status: 500 });
  }
}
