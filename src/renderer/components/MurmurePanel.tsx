import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, ArrowUpRight, Loader2, Brain } from 'lucide-react';
import { useStore } from '../store';
import {
  embedText, cosineSim, loadEmbeddingCache, saveEmbeddingCache,
  noteTextForEmbedding, type EmbedProgress,
} from '../embeddings';
import type { NoteMeta } from '../types';

/**
 * Murmure — semantic "related notes" panel powered by local embeddings.
 *
 * Pipeline:
 *   1) On first activation we load all-MiniLM-L6-v2 (~25 MB) via
 *      Transformers.js, then walk every note and embed
 *      `title + excerpt + tags`. Cached in localStorage.
 *   2) When the user opens a note, we fetch its embedding (computing it
 *      on the fly if missing/stale), then rank every other note by cosine
 *      similarity. Top 3 with score > a threshold are shown.
 *   3) Cache invalidates per note when its `updatedAt` advances.
 *
 * Failure modes:
 *   - Model download fails → we surface an error and offer to retry.
 *   - Single-note embed fails → we silently skip that note for now.
 *   - User dismisses for the session via the X button.
 */

type Suggestion = { note: NoteMeta; score: number };
type Phase = 'idle' | 'loading-model' | 'indexing' | 'ready' | 'error';

const SESSION_DISMISS_KEY = 'delinote.murmure.dismissed';
const SIM_THRESHOLD = 0.35;

export default function MurmurePanel() {
  const { current, index, selectNote } = useStore();

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<EmbedProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Re-show panel + recompute on every note change.
  useEffect(() => {
    setHidden(false);
    setCollapsed(false);
  }, [current?.id]);

  // Cancellation guard — if the open note changes mid-indexing, drop stale results.
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!current) { setSuggestions([]); return; }
    const myRun = ++runIdRef.current;

    (async () => {
      try {
        setError(null);
        const cache = loadEmbeddingCache();

        // ---- Step A: ensure the open note has a fresh embedding ----
        let myVec: Float32Array | undefined;
        const cachedMine = cache[current.id];
        if (cachedMine && cachedMine.t >= current.updatedAt) {
          myVec = new Float32Array(cachedMine.v);
        } else {
          if (myRun !== runIdRef.current) return;
          setPhase('loading-model');
          setProgress(null);
          const text = noteTextForEmbedding({
            title: current.title,
            excerpt: current.excerpt,
            tags: current.tags,
          });
          myVec = await embedText(text, (p) => {
            if (myRun !== runIdRef.current) return;
            setProgress(p);
          });
          cache[current.id] = { v: Array.from(myVec), t: current.updatedAt };
          saveEmbeddingCache(cache);
        }

        // ---- Step B: ensure every other (live) note has an embedding ----
        const others = index.notes.filter((n) => !n.trashed && n.id !== current.id);
        const stale = others.filter((n) => {
          const e = cache[n.id];
          return !e || e.t < n.updatedAt;
        });

        if (stale.length > 0) {
          if (myRun !== runIdRef.current) return;
          setPhase('indexing');
          let i = 0;
          for (const n of stale) {
            if (myRun !== runIdRef.current) return;
            i += 1;
            setProgress({ kind: 'embedding', current: i, total: stale.length });
            try {
              const v = await embedText(noteTextForEmbedding(n));
              cache[n.id] = { v: Array.from(v), t: n.updatedAt };
              // Persist every 10 entries so a crash doesn't lose everything.
              if (i % 10 === 0) saveEmbeddingCache(cache);
            } catch {
              // skip this note; will retry next time
            }
          }
          saveEmbeddingCache(cache);
        }

        // ---- Step C: rank ----
        if (myRun !== runIdRef.current) return;
        const scored: Suggestion[] = [];
        for (const n of others) {
          const e = cache[n.id];
          if (!e) continue;
          const score = cosineSim(myVec!, e.v);
          if (score >= SIM_THRESHOLD) scored.push({ note: n, score });
        }
        scored.sort((a, b) => b.score - a.score);
        if (myRun !== runIdRef.current) return;
        setSuggestions(scored.slice(0, 3));
        setPhase('ready');
        setProgress(null);
      } catch (e: any) {
        if (myRun !== runIdRef.current) return;
        console.warn('[murmure] failed', e);
        setPhase('error');
        setError(String(e?.message ?? e));
      }
    })();
  }, [current?.id, current?.updatedAt, index.notes]);

  if (!current || hidden) return null;
  if (phase === 'ready' && suggestions.length === 0) return null;

  function dismiss() {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch { /* ignore */ }
    setHidden(true);
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-30 w-[320px] theme-card rounded-xl shadow-2xl border theme-border-soft overflow-hidden pop-in"
      role="complementary"
      aria-label="Notes liées"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b theme-border-soft theme-bg-soft">
        <Sparkles size={13} className="theme-accent" />
        <span className="text-xs font-semibold theme-text flex-1">Murmure — notes similaires</span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="theme-muted hover:theme-text text-[10px] px-1"
          title={collapsed ? 'Déplier' : 'Réduire'}
        >
          {collapsed ? '▴' : '▾'}
        </button>
        <button onClick={dismiss} className="theme-muted hover:theme-text" title="Masquer pour cette session">
          <X size={12} />
        </button>
      </div>

      {!collapsed && (
        <div>
          {phase === 'loading-model' && (
            <div className="px-3 py-3 text-xs theme-muted">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={12} className="animate-spin theme-accent" />
                <span className="font-medium theme-text">Chargement du modèle d&apos;IA…</span>
              </div>
              {progress?.kind === 'download' && (
                <>
                  <div className="text-[10px] mb-1">
                    {Math.round((progress.ratio ?? 0) * 100)}% · {(progress.loaded / 1024 / 1024).toFixed(1)} Mo
                  </div>
                  <div className="h-1 rounded bg-black/10 overflow-hidden">
                    <div
                      className="h-full theme-accent-bg transition-all"
                      style={{ width: `${Math.round((progress.ratio ?? 0) * 100)}%` }}
                    />
                  </div>
                </>
              )}
              <p className="text-[10px] mt-2 theme-muted leading-relaxed">
                ~25 Mo, téléchargé une seule fois. Ensuite tout tourne en local sur ton ordi —
                aucun envoi vers le cloud, jamais.
              </p>
            </div>
          )}

          {phase === 'indexing' && progress?.kind === 'embedding' && (
            <div className="px-3 py-3 text-xs theme-muted">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={12} className="theme-accent animate-pulse" />
                <span className="font-medium theme-text">
                  Analyse de tes notes… {progress.current} / {progress.total}
                </span>
              </div>
              <div className="h-1 rounded bg-black/10 overflow-hidden">
                <div
                  className="h-full theme-accent-bg transition-all"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] mt-2 theme-muted leading-relaxed">
                Une seule fois — les résultats sont mis en cache pour les futures notes.
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="px-3 py-3 text-xs">
              <div className="font-medium text-red-500 mb-1">Erreur</div>
              <p className="theme-muted text-[10px] leading-relaxed">
                {error || 'Le modèle n\'a pas pu charger. Vérifie ta connexion (pour le premier téléchargement).'}
              </p>
              <button
                onClick={() => { setPhase('idle'); /* trigger via key change */ }}
                className="mt-2 text-[10px] theme-accent hover:opacity-80"
              >
                Réessayer
              </button>
            </div>
          )}

          {phase === 'ready' && suggestions.length > 0 && (
            <ul className="max-h-72 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.note.id}>
                  <button
                    onClick={() => void selectNote(s.note.id)}
                    className="w-full text-left px-3 py-2 hover:theme-hover border-b theme-border-soft last:border-b-0 transition group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium theme-text truncate flex-1">
                            {s.note.title || 'Sans titre'}
                          </div>
                          <span className="text-[10px] theme-muted tabular-nums shrink-0">
                            {Math.round(s.score * 100)}%
                          </span>
                        </div>
                        {s.note.excerpt && (
                          <div className="text-[10px] theme-muted mt-0.5 line-clamp-2">
                            {s.note.excerpt}
                          </div>
                        )}
                        {s.note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {s.note.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-[9px] px-1 py-0.5 rounded theme-accent-bg-soft theme-accent font-medium">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ArrowUpRight size={12} className="theme-muted opacity-0 group-hover:opacity-100 transition mt-0.5" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
