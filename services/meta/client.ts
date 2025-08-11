const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function authHeader(token?: string) {
  const accessToken = token || process.env.META_ACCESS_TOKEN; // fallback if using app token in dev
  if (!accessToken) throw new Error('META access token missing');
  return { Authorization: `Bearer ${accessToken}` };
}

export async function getInsights(adAccountId: string, params: Record<string, any>, token?: string) {
  const url = new URL(`${GRAPH_BASE}/act_${adAccountId}/insights`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)));
  const res = await fetch(url.toString(), { headers: { ...authHeader(token) } });
  if (!res.ok) throw new Error(`Insights error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function uploadImage(adAccountId: string, file: Blob | Buffer, filename: string, token?: string) {
  const form = new FormData();
  form.append('filename', filename);
  // @ts-ignore
  form.append('file', file, filename);
  const res = await fetch(`${GRAPH_BASE}/act_${adAccountId}/adimages`, {
    method: 'POST',
    headers: { ...authHeader(token) },
    body: form as any,
  });
  if (!res.ok) throw new Error(`AdImage upload failed ${res.status}: ${await res.text()}`);
  return res.json(); // contains image_hash
}

export async function createAdCreative(adAccountId: string, payload: any, token?: string) {
  const res = await fetch(`${GRAPH_BASE}/act_${adAccountId}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`AdCreative create failed ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function createAd(adAccountId: string, payload: any, token?: string) {
  const res = await fetch(`${GRAPH_BASE}/act_${adAccountId}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Ad create failed ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function validateAd(adAccountId: string, payload: any, token?: string) {
  const withValidate = {
    ...payload,
    execution_options: ['validate_only', 'include_recommendations'],
  };
  return createAd(adAccountId, withValidate, token);
}

export async function capiPurchase(pixelId: string, event: any, token?: string) {
  const res = await fetch(`${GRAPH_BASE}/${pixelId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ data: [event] }),
  });
  if (!res.ok) throw new Error(`CAPI event failed ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function exchangeToken(code: string, redirectUri: string) {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Token exchange failed ${res.status}: ${await res.text()}`);
  const data = await res.json(); // { access_token, token_type, expires_in }

  // Long-lived user token
  const ll = new URL(`${GRAPH_BASE}/oauth/access_token`);
  ll.searchParams.set('grant_type', 'fb_exchange_token');
  ll.searchParams.set('client_id', appId);
  ll.searchParams.set('client_secret', appSecret);
  ll.searchParams.set('fb_exchange_token', data.access_token);
  const llRes = await fetch(ll.toString());
  if (!llRes.ok) throw new Error(`Long-lived token exchange failed ${llRes.status}: ${await llRes.text()}`);
  const llData = await llRes.json();
  return { short: data, long: llData };
}
