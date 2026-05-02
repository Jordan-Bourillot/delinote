/**
 * Local sentence embeddings via Transformers.js running all-MiniLM-L6-v2
 * in WebAssembly. ~25 MB model, downloaded once from HuggingFace on first
 * use, then cached by the browser. Subsequent calls are fully offline.
 *
 * Used by Murmure (similar-note suggestions) — could be reused later for
 * Flux topic-segmentation or semantic search.
 */

export type EmbedProgress =
  | { kind: 'download'; file: string; loaded: number; total: number; ratio: number }
  | { kind: 'ready' }
  | { kind: 'embedding'; current: number; total: number };

let extractorPromise: Promise<any> | null = null;
let lastProgress: ((p: EmbedProgress) => void) | null = null;

async function getExtractor(onProgress?: (p: EmbedProgress) => void) {
  lastProgress = onProgress ?? null;
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const tf: any = await import('@xenova/transformers');
      tf.env.allowLocalModels = false;
      tf.env.useBrowserCache = true;
      return tf.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        progress_callback: (data: any) => {
          if (!lastProgress) return;
          if (data?.status === 'progress' || data?.status === 'download') {
            const total = data.total ?? 0;
            const loaded = data.loaded ?? 0;
            lastProgress({
              kind: 'download',
              file: data.file ?? '',
              loaded, total,
              ratio: total > 0 ? loaded / total : 0,
            });
          } else if (data?.status === 'ready' || data?.status === 'done') {
            lastProgress({ kind: 'ready' });
          }
        },
      });
    })().catch((err) => {
      extractorPromise = null;
      throw err;
    });
  }
  return extractorPromise;
}

/**
 * Embed a piece of text into a 384-dim vector (normalized, mean-pooled).
 * The model truncates inputs to 256 tokens — feed it the most relevant
 * portion (title + start of text typically works fine for note retrieval).
 */
export async function embedText(text: string, onProgress?: (p: EmbedProgress) => void): Promise<Float32Array> {
  const extractor = await getExtractor(onProgress);
  const out = await extractor(text, { pooling: 'mean', normalize: true });
  return out.data as Float32Array;
}

/**
 * Cosine similarity between two normalized vectors. Returns a value in
 * [-1, 1]; with normalize=true above this collapses to a plain dot product.
 */
export function cosineSim(a: Float32Array | number[], b: Float32Array | number[]): number {
  const len = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

// ---------- Persistent cache (per-note embeddings) ---------------------------
//
// Cache layout: localStorage["delinote.embeddings.v1"] = { [noteId]: { v, t } }
//   v: number[] (length 384)         — the embedding
//   t: number (note.updatedAt)       — invalidate when the note moves on
//
// Embeddings are kept in plain JSON (no base64) for simplicity. 384 floats
// × ~6 chars each ≈ 2.5 KB/note. Comfortable up to ~1k notes within the
// 5-10 MB localStorage budget.

const CACHE_KEY = 'delinote.embeddings.v1';

type CachedEmbedding = { v: number[]; t: number };
type Cache = Record<string, CachedEmbedding>;

export function loadEmbeddingCache(): Cache {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
export function saveEmbeddingCache(cache: Cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore quota */ }
}

/**
 * Build the per-note text the model sees. Keep it short (title carries most
 * of the topic signal; excerpt provides context). Tags are tacked on as
 * keywords so two untagged-but-tagged-similarly notes score higher.
 */
export function noteTextForEmbedding(meta: { title: string; excerpt: string; tags: string[] }): string {
  return `${meta.title}\n${meta.excerpt}\n${meta.tags.join(' ')}`.slice(0, 1500);
}
