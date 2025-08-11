import { NextResponse } from 'next/server';
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
    return NextResponse.json({ connected, expires_at: row?.expires_at ?? null });
  } catch (e: any) {
    // If DB is not configured, we still return connected false
    return NextResponse.json({ connected: false, error: e?.message || 'DB error' });
  }
}
