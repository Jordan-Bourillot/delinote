/**
 * Speech-to-text via Transformers.js running Whisper-tiny in WebAssembly.
 * Lazy-loaded so the ~75MB model isn't downloaded until the user actually
 * transcribes something for the first time. The model is cached by the
 * browser/Electron after the first run, so subsequent transcriptions are
 * fully offline.
 *
 * Note: contradicts the "100% offline" promise on the very first transcription
 * (model download from huggingface.co). We surface this clearly in the UI.
 */

let pipelinePromise: Promise<any> | null = null;
let lastProgress: ((p: ProgressEvent) => void) | null = null;

export type ProgressEvent =
  | { kind: 'download'; file: string; loaded: number; total: number; ratio: number }
  | { kind: 'ready' }
  | { kind: 'transcribing' };

async function getPipeline(onProgress?: (p: ProgressEvent) => void) {
  lastProgress = onProgress ?? null;
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const tf: any = await import('@xenova/transformers');
      // Force HF Hub remote (no local-path lookups) and enable browser cache.
      tf.env.allowLocalModels = false;
      tf.env.useBrowserCache = true;
      const pipe = await tf.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        progress_callback: (data: any) => {
          if (!lastProgress) return;
          if (data?.status === 'progress' || data?.status === 'download') {
            const total = data.total ?? 0;
            const loaded = data.loaded ?? 0;
            lastProgress({
              kind: 'download',
              file: data.file ?? '',
              loaded,
              total,
              ratio: total > 0 ? loaded / total : 0,
            });
          } else if (data?.status === 'ready' || data?.status === 'done') {
            lastProgress({ kind: 'ready' });
          }
        },
      });
      return pipe;
    })().catch((err) => {
      pipelinePromise = null; // allow retry after failure
      throw err;
    });
  }
  return pipelinePromise;
}

/**
 * Transcribe a recorded audio Blob (any format MediaRecorder produces) into
 * plain text. Audio is decoded to mono 16-kHz PCM in-browser before being
 * passed to Whisper. The `language` is auto-detected by Whisper itself.
 */
export async function transcribeBlob(
  blob: Blob,
  onProgress?: (p: ProgressEvent) => void,
): Promise<string> {
  const pipe = await getPipeline(onProgress);
  onProgress?.({ kind: 'transcribing' });
  const samples = await blobToFloat32At16k(blob);
  const out = await pipe(samples, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });
  const text = (Array.isArray(out) ? out.map((x: any) => x.text).join(' ') : out?.text) ?? '';
  return text.trim();
}

async function blobToFloat32At16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const tmpCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await tmpCtx.decodeAudioData(buf.slice(0));
  } finally {
    void tmpCtx.close();
  }
  const targetRate = 16000;
  const length = Math.ceil(decoded.duration * targetRate);
  const off = new OfflineAudioContext(1, length, targetRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start(0);
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);
}
