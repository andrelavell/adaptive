import { NextResponse } from 'next/server';
import { getServerMetaToken } from '@/lib/metaToken';
import { getAds } from '@/services/meta/client';
import { query as dbQuery } from '@/lib/db';

function uniq<T>(arr: (T | null | undefined)[]): T[] {
  return Array.from(new Set(arr.filter(Boolean) as T[]));
}

function pickPrimary<T>(arr: T[] | undefined | null): T | null {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

export async function GET(req: Request) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) return NextResponse.json({ error: 'META_AD_ACCOUNT_ID missing' }, { status: 500 });

  const token = await getServerMetaToken();
  if (!token) return NextResponse.json({ error: 'Meta token missing' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '200'), 1), 500);
  const after = searchParams.get('after') || undefined;

  // Fetch ads with nested creative fields (covers standard + Dynamic Creative)
  const fields = [
    'id',
    'name',
    'creative{'
      + 'id,name,'
      + 'object_story_spec{page_id,link_data{message,name,description,call_to_action{type},image_hash,picture}},'
      + 'asset_feed_spec{bodies{text},titles{text},descriptions{text},images{hash,url},call_to_action_types},'
      + 'image_hash,image_url,thumbnail_url'
    + '}'
  ].join(',');

  try {
    const data = await getAds(adAccountId, { fields, limit, after }, token.access_token);
    const items: any[] = Array.isArray(data?.data) ? data.data : [];

    let upserted = 0;
    let assetWrites = 0;

    for (const ad of items) {
      const adId: string = String(ad.id);
      const adName: string | null = ad.name || null;
      const cr = ad.creative || {};

      // Standard creative
      const oss = cr.object_story_spec || {};
      const pageId: string | null = oss.page_id || null;
      const link = oss.link_data || {};

      // Dynamic Creative
      const afs = cr.asset_feed_spec || {};
      const afBodies: string[] = (afs.bodies || []).map((b: any) => b?.text).filter(Boolean);
      const afTitles: string[] = (afs.titles || []).map((t: any) => t?.text).filter(Boolean);
      const afDescs: string[] = (afs.descriptions || []).map((d: any) => d?.text).filter(Boolean);
      const afImages: { hash?: string; url?: string }[] = (afs.images || []).map((i: any) => ({ hash: i?.hash, url: i?.url }));
      const afCtas: string[] = Array.isArray(afs.call_to_action_types) ? afs.call_to_action_types : [];

      // Primary fields (prefer DC assets if present, else object_story_spec, else creative top-level)
      const headline: string | null = pickPrimary(afTitles) || link.name || null;
      const body: string | null = pickPrimary(afBodies) || link.message || null;
      const description: string | null = pickPrimary(afDescs) || link.description || null;
      const ctaType: string | null = pickPrimary(afCtas) || link?.call_to_action?.type || null;

      const primaryImage = pickPrimary(afImages);
      const imageHash: string | null = primaryImage?.hash || cr.image_hash || link.image_hash || null;
      const imageUrl: string | null = primaryImage?.url || cr.image_url || link.picture || cr.thumbnail_url || null;
      const aspectRatio: string | null = null; // Not available without fetching media dimensions

      const creativeMetaId: string | null = cr.id || null;
      if (!creativeMetaId) {
        // If an ad has no creative payload, skip
        continue;
      }

      const metaPayload = cr ? JSON.stringify(cr) : null;

      // Insert-if-missing, then fetch id (UUID)
      const idRes = await dbQuery<{ id: string }>(
        `WITH ins AS (
          INSERT INTO creatives(ad_id, creative_id, name, page_id, headline, body, description, cta_type, image_hash, image_url, aspect_ratio, meta)
          SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb
          WHERE NOT EXISTS (SELECT 1 FROM creatives WHERE creative_id=$2)
          RETURNING id
        )
        SELECT id FROM ins
        UNION ALL
        SELECT id FROM creatives WHERE creative_id=$2
        LIMIT 1`,
        [
          adId,
          creativeMetaId,
          adName,
          pageId,
          headline,
          body,
          description,
          ctaType,
          imageHash,
          imageUrl,
          aspectRatio,
          metaPayload,
        ]
      );
      const rowId = idRes.rows?.[0]?.id;
      if (!rowId) continue;

      // Update latest fields to keep row current
      await dbQuery(
        `UPDATE creatives SET ad_id=$2, name=$3, page_id=$4, headline=$5, body=$6, description=$7, cta_type=$8, image_hash=$9, image_url=$10, aspect_ratio=$11, meta=$12, created_at=COALESCE(created_at, now())
         WHERE id=$1`,
        [rowId, adId, adName, pageId, headline, body, description, ctaType, imageHash, imageUrl, aspectRatio, metaPayload]
      );
      upserted += 1;

      // Refresh assets for this creative
      await dbQuery(`DELETE FROM assets WHERE creative_id=$1`, [rowId]);

      const assetRows: Array<{ type: string; value: string; meta?: any }> = [];
      for (const t of uniq(afTitles)) assetRows.push({ type: 'headline', value: t });
      for (const b of uniq(afBodies)) assetRows.push({ type: 'body', value: b });
      for (const d of uniq(afDescs)) assetRows.push({ type: 'description', value: d });
      if (ctaType) assetRows.push({ type: 'cta', value: ctaType });
      for (const img of afImages) {
        if (img?.hash || img?.url) assetRows.push({ type: 'image', value: img.hash || img.url!, meta: { url: img.url, hash: img.hash } });
      }

      if (assetRows.length) {
        const values: any[] = [];
        const chunks: string[] = [];
        let i = 1;
        for (const r of assetRows) {
          chunks.push(`($${i++}, $${i++}, $${i++}, $${i++}::jsonb)`);
          values.push(rowId, r.type, r.value, r.meta ? JSON.stringify(r.meta) : null);
        }
        await dbQuery(
          `INSERT INTO assets(creative_id, type, value, meta)
           VALUES ${chunks.join(',')}`,
          values
        );
        assetWrites += assetRows.length;
      }
    }

    const paging = data?.paging || null;
    const afterCursor = paging?.cursors?.after || null;

    return NextResponse.json({
      count: items.length,
      creatives_written: upserted,
      assets_written: assetWrites,
      paging: {
        after: afterCursor,
        next: paging?.next || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'creatives ingest failed' }, { status: 500 });
  }
}
