const OPENAI_BASE = 'https://api.openai.com/v1';

function headers() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export async function embedText(input: string) {
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`Embedding failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

export async function analyzeCreative(imageUrl: string, copy: { headline?: string; body?: string }) {
  const model = process.env.OPENAI_MODEL_RESPONSES || 'gpt-5';
  const input = [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: 'Extract JSON: subject, scene, composition, colors, people, emotion, props, text_on_image, hook_category, angle_summary, compliance_notes' },
        { type: 'input_image', image_url: imageUrl },
        { type: 'input_text', text: `Headline: ${copy.headline || ''}\nBody: ${copy.body || ''}` },
      ],
    },
  ];
  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`Analyze failed ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function generateImage(prompt: string, size: '1024x1024'|'1024x1280'|'1280x720'|'1024x1820' = '1024x1024') {
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const res = await fetch(`${OPENAI_BASE}/images`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  });
  if (!res.ok) throw new Error(`Image gen failed ${res.status}: ${await res.text()}`);
  return res.json();
}
