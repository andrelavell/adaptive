const OPENAI_BASE = 'https://api.openai.com/v1';

function getApiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('OPENAI_API_KEY is missing');
  return k;
}

export async function embedTextBatch(texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data?.data || []).map((d: any) => d.embedding as number[]);
}
