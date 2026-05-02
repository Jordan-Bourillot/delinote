// Generates resources/icon.ico (Windows) and resources/icon.png (macOS/Linux)
// from src/renderer/public/lion.png. White background is removed via flood-fill
// from the borders so the same image powers the in-app logo and the OS icon.
//
// Run automatically before electron-builder via `npm run icon`.

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'src', 'renderer', 'public', 'lion.png');
const RES_DIR = path.join(root, 'resources');
const PNG_OUT = path.join(RES_DIR, 'icon.png');
const ICO_OUT = path.join(RES_DIR, 'icon.ico');

const NEAR_WHITE = 235;

/** Flood-fill from borders to remove only the outer white background. */
async function removeOuterWhite(srcPath) {
  const img = sharp(srcPath).ensureAlpha();
  const meta = await img.metadata();
  const w = meta.width, h = meta.height;
  if (!w || !h) throw new Error('invalid image');
  const raw = await img.raw().toBuffer();
  const visited = new Uint8Array(w * h);

  function isNearWhite(idx) {
    const i = idx * 4;
    return Math.min(raw[i], raw[i + 1], raw[i + 2]) >= NEAR_WHITE;
  }

  const queue = [];
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const idx = y * w + x;
      if (isNearWhite(idx)) { visited[idx] = 1; queue.push(idx); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const idx = y * w + x;
      if (isNearWhite(idx)) { visited[idx] = 1; queue.push(idx); }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0)        { const n = idx - 1; if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); } }
    if (x < w - 1)    { const n = idx + 1; if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); } }
    if (y > 0)        { const n = idx - w; if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); } }
    if (y < h - 1)    { const n = idx + w; if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); } }
  }

  for (let i = 0; i < w * h; i++) if (visited[i]) raw[i * 4 + 3] = 0;

  return sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png();
}

async function main() {
  await fs.mkdir(RES_DIR, { recursive: true });
  try {
    await fs.access(SRC);
  } catch {
    console.warn(`[icon] No lion.png at ${SRC} — skipping icon generation. Save your image there to enable.`);
    return;
  }

  console.log('[icon] Removing outer white from lion.png…');
  const transparent = await removeOuterWhite(SRC);

  // 1024x1024 main PNG (macOS / Linux)
  console.log('[icon] Writing resources/icon.png (1024)…');
  const big = await transparent.clone().resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await fs.writeFile(PNG_OUT, big);

  // ICO with multi-resolutions for Windows
  console.log('[icon] Generating multi-res Windows .ico…');
  const sizes = [16, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(sizes.map((s) =>
    transparent.clone().resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
  ));
  const ico = await pngToIco(buffers);
  await fs.writeFile(ICO_OUT, ico);
  console.log('[icon] Done — resources/icon.ico + resources/icon.png');
}

main().catch((e) => {
  console.error('[icon] Failed:', e);
  process.exitCode = 1;
});
