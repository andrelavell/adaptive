import { NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';
import { embedTextBatch } from '@/services/openai/client';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '100'), 1), 500);
  const model = searchParams.get('model') || 'text-embedding-3-small';

  try {
    // Fetch asset texts that don't yet have an embedding for this model
    const toEmbed = await dbQuery<{
      id: string;
      type: string;
      value: string;
    }>(
      `SELECT a.id, a.type, a.value
       FROM assets a
       LEFT JOIN embeddings e
         ON e.ref_table = 'assets' AND e.ref_id = a.id AND e.kind = 'text' AND e.model = $1
       WHERE a.type IN ('headline','body','description')
         AND a.value IS NOT NULL AND a.value <> ''
         AND e.id IS NULL
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [model, String(limit)]
    );

    const rows = toEmbed.rows || [];
    if (!rows.length) {
      return NextResponse.json({ embedded: 0, message: 'No new text assets to embed' });
    }

    const texts = rows.map((r) => r.value);
    const vectors = await embedTextBatch(texts, model);
    if (vectors.length !== rows.length) {
      throw new Error(`Embedding count mismatch: got ${vectors.length}, expected ${rows.length}`);
    }

    // Build VALUES insert with vector casts
    const values: any[] = [];
    const placeholders: string[] = [];
    let i = 1;
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const vec = vectors[idx];
      const vecText = `[${vec.join(',')}]`; // pgvector text literal
      // ref_table, ref_id::uuid, kind, model, vector::vector
      placeholders.push(`($${i++}, $${i++}::uuid, $${i++}, $${i++}, $${i++}::vector)`);
      values.push('assets', r.id, 'text', model, vecText);
    }

    await dbQuery(
      `INSERT INTO embeddings(ref_table, ref_id, kind, model, vector)
       VALUES ${placeholders.join(',')}`,
      values
    );

    return NextResponse.json({ embedded: rows.length, model, types: Array.from(new Set(rows.map((r) => r.type))) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'embed-text failed' }, { status: 500 });
  }
}
