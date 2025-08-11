import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(
      `SELECT provider, expires_at
       FROM tokens
       WHERE provider = 'meta'
       ORDER BY expires_at DESC
       LIMIT 1`
    );
    const row = res.rows?.[0];
    const connected = !!row && new Date(row.expires_at) > new Date();
    if (connected) {
      return NextResponse.json({ connected: true, expires_at: row!.expires_at });
    }
  } catch (e: any) {
    // Fall through to cookie fallback
  }

  // Cookie fallback: set by /api/auth/meta/callback
  try {
    const jar = cookies();
    const raw = jar.get('meta_token')?.value;
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: string };
      const valid = !!parsed.access_token && !!parsed.expires_at && new Date(parsed.expires_at!) > new Date();
      return NextResponse.json({ connected: valid, expires_at: valid ? parsed.expires_at! : null });
    }
  } catch (e: any) {
    return NextResponse.json({ connected: false, error: e?.message || 'cookie parse error' });
  }

  return NextResponse.json({ connected: false, expires_at: null });
}
