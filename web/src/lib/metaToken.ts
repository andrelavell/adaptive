import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export type MetaToken = { access_token: string; expires_at?: string | null };

export async function getServerMetaToken(): Promise<MetaToken | null> {
  // Try database first
  try {
    const res = await query<{ access_token: string; expires_at: string }>(
      `SELECT access_token, expires_at FROM tokens WHERE provider='meta' ORDER BY expires_at DESC LIMIT 1`
    );
    const row = res.rows?.[0];
    if (row && new Date(row.expires_at) > new Date()) {
      return { access_token: row.access_token, expires_at: row.expires_at };
    }
  } catch {
    // ignore and fall back to cookie
  }

  // Cookie fallback set by OAuth callback
  try {
    const raw = cookies().get('meta_token')?.value;
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: string };
      if (parsed.access_token && parsed.expires_at && new Date(parsed.expires_at) > new Date()) {
        return { access_token: parsed.access_token, expires_at: parsed.expires_at };
      }
    }
  } catch {
    // ignore
  }

  // Optional env fallback for personal use
  if (process.env.META_ACCESS_TOKEN) {
    return { access_token: process.env.META_ACCESS_TOKEN, expires_at: null };
  }

  return null;
}
