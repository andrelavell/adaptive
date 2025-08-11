import { cookies } from 'next/headers';

export function getServerMetaToken(): string | null {
  try {
    const raw = cookies().get('meta_token')?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: string };
    if (!parsed.access_token || !parsed.expires_at) return null;
    if (new Date(parsed.expires_at) <= new Date()) return null;
    return parsed.access_token;
  } catch {
    return null;
  }
}
