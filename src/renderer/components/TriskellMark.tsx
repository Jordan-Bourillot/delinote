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
  // Triskèle redesign — three rounded teardrop petals at 120° with a tiny
  // swirl (one side longer than the other so the whole thing reads as
  // "movement / spiral" rather than "static cloverleaf"). White core for
  // strong pop against any background. Tested at 11 / 14 / 18 px.
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
        {/* Petal — wide at center, tapering to a curled tip up-and-right */}
        <path
          d="M -3 1 Q -5 -3 -1 -10 Q 3 -15 7 -11 Q 9 -7 5 -3 Q 1 0 -3 1 Z"
          fill="#F37223"
        />
        <path
          d="M -3 1 Q -5 -3 -1 -10 Q 3 -15 7 -11 Q 9 -7 5 -3 Q 1 0 -3 1 Z"
          fill="#6366F1"
          transform="rotate(120)"
        />
        <path
          d="M -3 1 Q -5 -3 -1 -10 Q 3 -15 7 -11 Q 9 -7 5 -3 Q 1 0 -3 1 Z"
          fill="#FACC15"
          transform="rotate(240)"
        />
        {/* Central pearl — subtle inner shadow via stroke for definition */}
        <circle r="3.4" fill="#FFFFFF" />
        <circle r="3.4" fill="none" stroke="rgba(27,35,48,0.18)" strokeWidth="0.6" />
      </g>
    </svg>
  );
}
