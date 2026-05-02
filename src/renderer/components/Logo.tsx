import { useEffect, useState } from 'react';

const LION_IMAGE = './lion.png';

// Process the lion once on app startup and push to the OS taskbar/window icon.
let iconAlreadyPushed = false;
function pushTransparentIconToOs(dataUrl: string) {
  if (iconAlreadyPushed) return;
  iconAlreadyPushed = true;
  try {
    void window.nv?.setWindowIcon?.(dataUrl);
  } catch { /* ignore */ }
}

/**
 * DéliNote logo.
 * Loads `src/renderer/public/lion.png` and removes its white background at runtime
 * (canvas-based: any near-white pixel becomes transparent, with soft anti-aliased edges).
 * Falls back to an inline SVG lion if the file is missing.
 */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) { setFailed(true); return; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setFailed(true); return; }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const px = imageData.data;

        // Flood-fill from the image borders: only WHITE pixels reachable from
        // the outside become transparent. White pixels enclosed inside the
        // lion silhouette (face details, eye whites, etc.) are preserved.
        const total = w * h;
        const visited = new Uint8Array(total);
        const NEAR_WHITE = 235;

        const isNearWhite = (idx: number) => {
          const i = idx * 4;
          return Math.min(px[i], px[i + 1], px[i + 2]) >= NEAR_WHITE;
        };

        const queue: number[] = [];
        // Seed from every border pixel that is near-white
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

        // BFS — index-based queue for speed
        let head = 0;
        while (head < queue.length) {
          const idx = queue[head++];
          const x = idx % w;
          const y = (idx - x) / w;
          // 4-neighbours
          if (x > 0) {
            const n = idx - 1;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); }
          }
          if (x < w - 1) {
            const n = idx + 1;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); }
          }
          if (y > 0) {
            const n = idx - w;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); }
          }
          if (y < h - 1) {
            const n = idx + w;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; queue.push(n); }
          }
        }

        // Apply transparency to outer-white pixels.
        // Then soften the boundary: any visited pixel that has at least one
        // non-visited neighbour gets full transparency; the next ring (off-white
        // pixels just inside) gets partial alpha for anti-aliasing.
        for (let i = 0; i < total; i++) {
          if (visited[i]) {
            px[i * 4 + 3] = 0;
          } else {
            const a = px[i * 4 + 3];
            const minRgb = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
            // Slight feather: pixels just inside the silhouette that are
            // partially white get a small alpha bump down for smooth edges.
            if (a > 0 && minRgb > 215 && minRgb < NEAR_WHITE) {
              const x = i % w;
              const y = (i - x) / w;
              let touchesOutside = false;
              if (x > 0 && visited[i - 1]) touchesOutside = true;
              else if (x < w - 1 && visited[i + 1]) touchesOutside = true;
              else if (y > 0 && visited[i - w]) touchesOutside = true;
              else if (y < h - 1 && visited[i + w]) touchesOutside = true;
              if (touchesOutside) {
                px[i * 4 + 3] = Math.round(((minRgb - 215) / (NEAR_WHITE - 215)) * 0 + ((NEAR_WHITE - minRgb) / (NEAR_WHITE - 215)) * 255);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const url = canvas.toDataURL('image/png');
        setDataUrl(url);
        pushTransparentIconToOs(url);
      } catch {
        setFailed(true);
      }
    };
    img.onerror = () => { if (!cancelled) setFailed(true); };
    img.src = LION_IMAGE;
    return () => { cancelled = true; };
  }, []);

  if (failed) return <SvgLion size={size} className={className} />;
  if (!dataUrl) {
    // Reserve space while processing to avoid layout shift
    return <div style={{ width: size, height: size }} className={className} />;
  }
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="DéliNote"
      className={`object-contain ${className}`}
      style={{ display: 'block' }}
      draggable={false}
    />
  );
}

function SvgLion({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="DéliNote">
      <defs>
        <linearGradient id="nvGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="40%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#7c3a05" />
        </linearGradient>
        <linearGradient id="nvGoldDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c98a17" />
          <stop offset="100%" stopColor="#5b2a04" />
        </linearGradient>
        <linearGradient id="nvSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="url(#nvGold)">
        <path d="M68 64 L132 64 L126 76 L74 76 Z" />
        <path d="M72 64 L80 50 L88 64 Z" />
        <path d="M89 64 L100 38 L111 64 Z" />
        <path d="M112 64 L120 50 L128 64 Z" />
        <path d="M97 38 L100 32 L103 38 Z" />
        <circle cx="100" cy="34" r="2.5" fill="url(#nvGoldDark)" />
        {Array.from({ length: 18 }).map((_, i) => {
          const angle = (i / 18) * Math.PI * 2 - Math.PI / 2;
          const skip = i >= 6 && i <= 12;
          if (skip) return null;
          const cx = 100, cy = 116, innerR = 60, outerR = 88;
          const halfWidth = (Math.PI * 2) / 36;
          const x1 = cx + Math.cos(angle - halfWidth) * innerR;
          const y1 = cy + Math.sin(angle - halfWidth) * innerR;
          const x2 = cx + Math.cos(angle + halfWidth) * innerR;
          const y2 = cy + Math.sin(angle + halfWidth) * innerR;
          const xt = cx + Math.cos(angle) * outerR;
          const yt = cy + Math.sin(angle) * outerR;
          return <polygon key={i} points={`${x1},${y1} ${xt},${yt} ${x2},${y2}`} />;
        })}
        <circle cx="100" cy="116" r="62" />
      </g>
      <g fill="url(#nvGoldDark)" opacity="0.55">
        <polygon points="50,90 80,120 60,150" />
        <polygon points="150,90 120,120 140,150" />
        <polygon points="40,140 75,140 70,170" />
        <polygon points="160,140 125,140 130,170" />
        <polygon points="45,110 70,100 75,135" />
        <polygon points="155,110 130,100 125,135" />
      </g>
      <g fill="#ffffff">
        <path d="M85 78 L100 90 L115 78 L115 92 L100 102 L85 92 Z" />
        <polygon points="78,108 92,108 90,118 80,118" />
        <polygon points="108,108 122,108 120,118 110,118" />
        <polygon points="62,118 78,128 76,140 60,138" />
        <polygon points="122,128 138,118 140,138 124,140" />
        <path d="M88 122 L112 122 L116 134 L100 144 L84 134 Z" />
        <polygon points="92,146 100,156 108,146" />
        <polygon points="88,160 100,178 112,160" />
        <polygon points="70,154 85,158 82,170" />
        <polygon points="130,154 115,158 118,170" />
      </g>
      <g fill="url(#nvGold)">
        <polygon points="96,128 104,128 100,138" />
      </g>
      <ellipse cx="100" cy="80" rx="60" ry="20" fill="url(#nvSheen)" />
    </svg>
  );
}
