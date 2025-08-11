import { Pool } from 'pg';
import dns from 'node:dns';
// Prefer IPv4 first to avoid IPv6 ENETUNREACH in some serverless environments
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

// In some providers the upstream CA chain is self-signed. When PGSSL is set,
// explicitly disable TLS cert verification to allow connecting over SSL.
if (process.env.PGSSL) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('DATABASE_URL not set. DB client will be inactive.');
}

export const db = connectionString
  ? new Pool({ connectionString, ssl: process.env.PGSSL ? { rejectUnauthorized: false } : undefined })
  : (null as unknown as Pool);

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }>{
  if (!db) throw new Error('DB not configured');
  const client = await db.connect();
  try {
    const res = await client.query(text, params);
    return { rows: res.rows as T[] };
  } finally {
    client.release();
  }
}
