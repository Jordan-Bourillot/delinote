import { useEffect, useState } from 'react';

/** URL canonique du studio — source unique pour tous les liens "par Triskell Studio". */
export const TRISKELL_URL = 'https://triskell-studio.fr';

/** Ouvre l'URL Triskell dans le navigateur système (via Electron preload). */
export function openTriskellSite(): void {
  try {
    const nv = (window as any).nv;
    if (nv && typeof nv.openExternal === 'function') {
      void nv.openExternal(TRISKELL_URL);
    } else {
      window.open(TRISKELL_URL, '_blank', 'noopener');
    }
  } catch {
    /* ignore */
  }
}

/**
 * Triskell Studio mark.
 *
 * Loads `src/renderer/public/triskell.png` (or .svg) if present — drop your
 * official logo there to override. Falls back to an inline 3-color triskelion
 * (indigo / violet / orange) — la vraie identité de marque.
 */
export function TriskellMark({ size = 14, className = '' }: { size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const candidates = ['./triskell.svg', './triskell.png', './triskell.webp'];
    (async () => {
      for (const url of candidates) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
        if (cancelled) return;
        if (ok) { setSrc(url); return; }
      }
      setFailed(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (src) {
    return (
      <img
        src={src}
        width={size}
        height={size}
        alt="Triskell Studio"
        className={`object-contain ${className}`}
        style={{ display: 'inline-block', verticalAlign: 'middle' }}
        draggable={false}
      />
    );
  }
  if (!failed && !src) {
    return <span style={{ display: 'inline-block', width: size, height: size }} className={className} />;
  }
  return <SvgFallback size={size} className={className} />;
}

function SvgFallback({ size, className }: { size: number; className: string }) {
  // Triskèle v2 — three symmetric leaf petals at exact 120° intervals.
  // Symmetry matters at small sizes : asymmetric curls turn into mush.
  // Bold strokes around each petal give edge definition on any bg.
  // Centre dot in dark navy = visible on white badges and on light bgs alike.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Triskell Studio"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <g transform="translate(18 18)">
        {/* Symmetric leaf — points straight up from centre */}
        <g stroke="#1B2330" strokeWidth="0.7" strokeLinejoin="round">
          <path d="M 0 -3.2 Q -4 -8 0 -13.5 Q 4 -8 0 -3.2 Z" fill="#F37223" />
          <path d="M 0 -3.2 Q -4 -8 0 -13.5 Q 4 -8 0 -3.2 Z" fill="#6366F1" transform="rotate(120)" />
          <path d="M 0 -3.2 Q -4 -8 0 -13.5 Q 4 -8 0 -3.2 Z" fill="#FACC15" transform="rotate(240)" />
        </g>
        {/* Centre hub — dark core with thin rim, reads on any background */}
        <circle r="3.4" fill="#1B2330" />
        <circle r="3.4" fill="none" stroke="#FFFFFF" strokeWidth="0.7" />
      </g>
    </svg>
  );
}
