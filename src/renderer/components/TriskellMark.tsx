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
      {/* Triskèle officiel : 3 feuilles spirale rotatées de 120° en indigo / violet / orange */}
      <path d="M18,18 C20,15 22,10 20,6 C18,2 13,3 13,7.5 C13,12 16,15.5 18,18Z" fill="#6366F1" />
      <path d="M18,18 C20,15 22,10 20,6 C18,2 13,3 13,7.5 C13,12 16,15.5 18,18Z" fill="#8B5CF6" transform="rotate(120 18 18)" />
      <path d="M18,18 C20,15 22,10 20,6 C18,2 13,3 13,7.5 C13,12 16,15.5 18,18Z" fill="#F97316" transform="rotate(240 18 18)" />
      <circle cx="18" cy="18" r="2.6" fill="currentColor" />
    </svg>
  );
}
