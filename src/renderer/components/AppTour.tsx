import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

const TOUR_KEY = 'delinote.uitour.done';

export function shouldShowTour(): boolean {
  try { return localStorage.getItem(TOUR_KEY) !== '1'; } catch { return false; }
}
export function markTourDone() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
}
/** Reset for testing — open DevTools console and run: window.__resetTour() */
if (typeof window !== 'undefined') {
  (window as any).__resetTour = () => { try { localStorage.removeItem(TOUR_KEY); location.reload(); } catch {} };
}

type Step = {
  selector: string | null; // null = centered finale, no spotlight
  title: string;
  body: string;
  position?: 'right' | 'left' | 'bottom' | 'top';
};

/**
 * Petite "queue de bulle" SVG ancrée sur le bord de la bulle qui fait face à la zone,
 * pointant directement vers le spotlight orange. Compatible tous les thèmes via
 * var(--card) (fond) et var(--border) (contour).
 */
function ArrowTail({ pos }: { pos: 'right' | 'left' | 'bottom' | 'top' }) {
  const LEN = 14;   // longueur que la flèche dépasse de la bulle
  const BASE = 22;  // largeur de la base
  let style: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };
  let w = 0, h = 0;
  let fillPath = '';
  let strokePts = '';

  if (pos === 'right') {
    // Bulle à droite de la zone → tail à gauche de la bulle, pointe vers la gauche
    style.left = -LEN + 1; style.top = 36;
    w = LEN; h = BASE;
    fillPath = `M ${LEN} 0 L 0 ${BASE / 2} L ${LEN} ${BASE} Z`;
    strokePts = `${LEN},0 0,${BASE / 2} ${LEN},${BASE}`;
  } else if (pos === 'left') {
    style.right = -LEN + 1; style.top = 36;
    w = LEN; h = BASE;
    fillPath = `M 0 0 L ${LEN} ${BASE / 2} L 0 ${BASE} Z`;
    strokePts = `0,0 ${LEN},${BASE / 2} 0,${BASE}`;
  } else if (pos === 'bottom') {
    style.top = -LEN + 1; style.left = 36;
    w = BASE; h = LEN;
    fillPath = `M 0 ${LEN} L ${BASE / 2} 0 L ${BASE} ${LEN} Z`;
    strokePts = `0,${LEN} ${BASE / 2},0 ${BASE},${LEN}`;
  } else { // 'top'
    style.bottom = -LEN + 1; style.left = 36;
    w = BASE; h = LEN;
    fillPath = `M 0 0 L ${BASE / 2} ${LEN} L ${BASE} 0 Z`;
    strokePts = `0,0 ${BASE / 2},${LEN} ${BASE},0`;
  }

  return (
    <svg style={style} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {/* Fond plein qui matche la bulle (cache le seam avec le bord de la bulle) */}
      <path d={fillPath} style={{ fill: 'var(--card)' }} />
      {/* Contour des deux arêtes extérieures uniquement (pas la base, qui touche la bulle) */}
      <polyline points={strokePts} style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1, strokeLinejoin: 'round' }} />
    </svg>
  );
}

const STEPS: Step[] = [
  {
    selector: '[data-tour="sidebar"]',
    title: '1. La barre latérale',
    body: 'Vos carnets, étiquettes et raccourcis. Tout en un coup d\'œil. Cliquez sur un carnet pour filtrer la liste de notes.',
    position: 'right',
  },
  {
    selector: '[data-tour="notelist"]',
    title: '2. La liste de notes',
    body: 'Toutes les notes du carnet ou de la vue sélectionnée. Cliquez pour ouvrir, glissez pour réorganiser, clic droit pour les actions.',
    position: 'right',
  },
  {
    selector: '[data-tour="tabs"]',
    title: '3. Les onglets',
    body: 'Plusieurs notes ouvertes en parallèle, comme un navigateur. Idéal pour comparer ou rebondir entre idées.',
    position: 'bottom',
  },
  {
    selector: '[data-tour="editor"]',
    title: '4. L\'éditeur',
    body: 'Votre zone d\'écriture. Markdown natif, raccourcis clavier complets, formatage en temps réel. Tapez « / » pour les commandes.',
    position: 'left',
  },
  {
    selector: null,
    title: 'C\'est parti !',
    body: 'Astuce : ⌘K (ou Ctrl+K) pour chercher en éclair · F1 pour tous les raccourcis · ⚙ en haut à gauche pour les réglages. Bonne écriture.',
  },
];

const BUBBLE_W = 340;
const PAD = 14;
const HOLE_PAD = 6;

export default function AppTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  const measure = useCallback(() => {
    const sel = STEPS[step].selector;
    if (!sel) { setRect(null); return; }
    const el = document.querySelector(sel) as HTMLElement | null;
    setRect(el ? el.getBoundingClientRect() : null);
    setVp({ w: window.innerWidth, h: window.innerHeight });
  }, [step]);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    const id = window.setInterval(measure, 500); // catch animations / layout shifts
    return () => { window.removeEventListener('resize', onResize); window.clearInterval(id); };
  }, [measure]);

  // Keyboard: Esc to close, ←/→ to navigate
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function finish() { markTourDone(); onClose(); }
  function next() {
    if (step >= STEPS.length - 1) finish();
    else setStep(step + 1);
  }
  function prev() { setStep(Math.max(0, step - 1)); }

  const cur = STEPS[step];
  const isFinale = !cur.selector;

  // Compute bubble position
  let bubbleStyle: React.CSSProperties = {};
  if (isFinale || !rect) {
    bubbleStyle = {
      left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: BUBBLE_W,
    };
  } else {
    const pos = cur.position || 'right';
    let left = 0, top = 0;
    if (pos === 'right')       { left = rect.right + PAD; top = Math.max(PAD, rect.top + 20); }
    else if (pos === 'left')   { left = rect.left - BUBBLE_W - PAD; top = Math.max(PAD, rect.top + 20); }
    else if (pos === 'bottom') { left = Math.max(PAD, rect.left); top = rect.bottom + PAD; }
    else                       { left = Math.max(PAD, rect.left); top = rect.top - 220 - PAD; }
    // Clamp inside viewport
    left = Math.min(left, vp.w - BUBBLE_W - PAD);
    left = Math.max(PAD, left);
    top  = Math.min(top, vp.h - 200 - PAD);
    top  = Math.max(PAD, top);
    bubbleStyle = { left, top, width: BUBBLE_W };
  }

  // Spotlight cutout
  const hole = rect ? {
    x: Math.max(0, rect.left - HOLE_PAD),
    y: Math.max(0, rect.top - HOLE_PAD),
    w: rect.width + HOLE_PAD * 2,
    h: rect.height + HOLE_PAD * 2,
  } : null;

  return (
    <div className="fixed inset-0 z-[60]" aria-modal="true" role="dialog" aria-label="Visite guidée de DéliNote">
      {/* Backdrop with optional spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'auto' }} onClick={next}>
        <defs>
          <mask id="dn-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={10} ry={10} fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(11,11,15,0.62)" mask="url(#dn-tour-mask)" />
        {hole && (
          <rect
            x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={10} ry={10}
            fill="none" stroke="#FF5B2E" strokeWidth="2.5"
            style={{ filter: 'drop-shadow(0 0 12px rgba(255,91,46,.65))' }}
          />
        )}
      </svg>

      {/* Bubble */}
      <div
        className="absolute theme-card rounded-2xl shadow-2xl border theme-border p-5"
        style={{ ...bubbleStyle, pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isFinale && cur.position && <ArrowTail pos={cur.position} />}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 theme-accent-bg' :
                  i < step ? 'w-3 theme-accent-bg opacity-50' :
                  'w-3 theme-toggle-off'
                }`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="theme-muted hover:theme-text text-xs flex items-center gap-1"
            title="Passer la visite (Échap)"
            aria-label="Passer"
          >
            Passer <X size={12} />
          </button>
        </div>

        {isFinale && (
          <div className="flex items-center gap-2 mb-2 theme-accent">
            <Sparkles size={18} />
          </div>
        )}
        <h3 className="text-base font-semibold theme-text leading-tight">{cur.title}</h3>
        <p className="text-sm theme-muted mt-2 leading-relaxed">{cur.body}</p>

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={prev}
            disabled={step === 0}
            className="text-sm theme-muted hover:theme-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft size={14} /> Retour
          </button>
          <button
            onClick={next}
            className="text-sm px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm font-medium flex items-center gap-1.5"
          >
            {step === STEPS.length - 1 ? 'C\'est parti !' : 'Suivant'}
            {step < STEPS.length - 1 && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
