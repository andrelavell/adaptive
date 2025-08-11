import { NextResponse } from 'next/server';
import { exchangeToken } from '@/services/meta/client';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const origin = new URL(req.url).origin;
  const base = process.env.APP_BASE_URL || origin;
  const redirect = process.env.META_REDIRECT_URI || `${base}/api/auth/meta/callback`;
  const tokens = await exchangeToken(code, redirect);

  // Compute expiry and prepare response
  const maxAge = Number(tokens.long.expires_in || 60 * 60 * 24 * 60); // seconds
  const expiresAtISO = new Date(Date.now() + maxAge * 1000).toISOString();
  const res = NextResponse.redirect(process.env.APP_BASE_URL || '/');

  // Always set a cookie fallback so the app works even if DB is unavailable
  try {
    res.cookies.set(
      'meta_token',
      JSON.stringify({ access_token: tokens.long.access_token, expires_at: expiresAtISO }),
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      }
    );
  } catch (e) {
    console.error('Failed setting meta_token cookie', e);
  }

  // Persist long-lived token (best-effort)
  try {
    await query(
      `INSERT INTO tokens(provider, access_token, token_type, expires_at, meta) VALUES($1,$2,$3, now() + ($4 || ' seconds')::interval, $5)`,
      ['meta', tokens.long.access_token, tokens.long.token_type || 'bearer', String(maxAge), JSON.stringify(tokens)]
    );
  } catch (e: any) {
    console.error('Token store failed', e);
  }

  return res;
}
