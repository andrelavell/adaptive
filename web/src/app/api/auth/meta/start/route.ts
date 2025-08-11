import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const appId = process.env.META_APP_ID!;
  const origin = new URL(req.url).origin;
  const base = process.env.APP_BASE_URL || origin;
  const redirect = process.env.META_REDIRECT_URI || `${base}/api/auth/meta/callback`;
  const scope = ['ads_read','ads_management'].join(',');
  const version = process.env.META_GRAPH_VERSION || 'v23.0';
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  return NextResponse.redirect(url.toString());
}
