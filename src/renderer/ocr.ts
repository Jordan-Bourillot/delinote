/**
 * OCR via Tesseract.js — lazy-loaded so the ~30MB language data isn't pulled
 * until the user actually runs OCR for the first time.
 * Uses French + English language pack by default.
 */

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['fra', 'eng']);
      return worker;
    })();
  }
  return workerPromise;
}

/** Run OCR on a base64 image data URL or a Blob. Returns the recognized text. */
export async function ocrImage(input: string | Blob): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(input);
  return (data?.text ?? '').trim();
}

/** Free the OCR worker (called when the user truly stops needing OCR). */
export async function disposeOcr() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch { /* ignore */ }
  workerPromise = null;
}
