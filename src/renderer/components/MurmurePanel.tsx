import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X, ArrowUpRight } from 'lucide-react';
import { useStore } from '../store';
import type { NoteMeta } from '../types';

/**
 * Murmure — discreet bottom-right bubble that surfaces notes related to the
 * one currently open. Uses a tag-overlap + keyword-overlap heuristic (no
 * embeddings, no model, no network). Local-only by design.
 *
 * Scoring per candidate note:
 *   +3 per shared tag
 *   +1 per shared keyword (≥4 chars, lowercased, deduped per note)
 *   The current note is excluded.
 *   Notes are ranked by score desc and we keep the top 3 (score > 0).
 *
 * Re-runs whenever the open note changes. Dismissable for the session.
 */

const STOPWORDS = new Set([
  'avec', 'sans', 'pour', 'dans', 'sur', 'sous', 'mais', 'donc', 'car', 'puis',
  'aussi', 'comme', 'plus', 'tout', 'tous', 'cette', 'cela', 'celui', 'celle',
  'leur', 'leurs', 'mon', 'ton', 'son', 'ses', 'mes', 'tes', 'nos', 'vos',
  'que', 'qui', 'quoi', 'dont', 'parce', 'lorsque', 'alors', 'voici', 'voila',
  'avoir', 'etre', 'faire', 'avant', 'apres', 'depuis', 'jusqu', 'meme',
  'this', 'that', 'with', 'from', 'have', 'will', 'they', 'them', 'their',
  'about', 'into', 'over', 'under', 'than', 'then', 'when', 'where', 'what',
  'which', 'because', 'just', 'still', 'very', 'much', 'many', 'some', 'most',
]);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  const cleaned = text
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  for (const w of cleaned.split(/\s+/)) {
    if (w.length < 4) continue;
    if (STOPWORDS.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    out.add(w);
  }
  return out;
}

type Suggestion = { note: NoteMeta; score: number; sharedTags: string[]; sharedKeywords: string[] };

const SESSION_DISMISS_KEY = 'delinote.murmure.dismissed';

export default function MurmurePanel() {
  const { current, index, selectNote } = useStore();
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState(false);

  // Re-show panel whenever the current note changes (dismiss is per-session
  // but should "reset" mentally as the user explores new notes).
  useEffect(() => {
    setHidden(false);
    setCollapsed(false);
  }, [current?.id]);

  const suggestions: Suggestion[] = useMemo(() => {
    if (!current) return [];
    const myTags = new Set(current.tags);
    const myTokens = tokens(`${current.title} ${current.text}`);
    const out: Suggestion[] = [];
    for (const n of index.notes) {
      if (n.trashed) continue;
      if (n.id === current.id) continue;
      const sharedTags = n.tags.filter((t) => myTags.has(t));
      const otherTokens = tokens(`${n.title} ${n.excerpt}`);
      const sharedKeywords: string[] = [];
      for (const tk of myTokens) if (otherTokens.has(tk)) sharedKeywords.push(tk);
      const score = sharedTags.length * 3 + sharedKeywords.length;
      if (score > 0) out.push({ note: n, score, sharedTags, sharedKeywords });
    }
    out.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt);
    return out.slice(0, 3);
  }, [current?.id, current?.text, current?.title, current?.tags, index.notes]);

  if (!current || hidden || suggestions.length === 0) return null;

  function dismiss() {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch { /* ignore */ }
    setHidden(true);
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-30 max-w-[300px] theme-card rounded-xl shadow-2xl border theme-border-soft overflow-hidden pop-in"
      role="complementary"
      aria-label="Notes liées"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b theme-border-soft theme-bg-soft">
        <Sparkles size={13} className="theme-accent" />
        <span className="text-xs font-semibold theme-text flex-1">Murmure — notes liées</span>
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
        <ul className="max-h-72 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.note.id}>
              <button
                onClick={() => void selectNote(s.note.id)}
                className="w-full text-left px-3 py-2 hover:theme-hover border-b theme-border-soft last:border-b-0 transition group"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium theme-text truncate">
                      {s.note.title || 'Sans titre'}
                    </div>
                    <div className="text-[10px] theme-muted mt-0.5 flex flex-wrap gap-1">
                      {s.sharedTags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="px-1 py-0.5 rounded theme-accent-bg-soft theme-accent font-medium"
                        >
                          #{t}
                        </span>
                      ))}
                      {s.sharedKeywords.slice(0, 3).map((k) => (
                        <span key={k} className="theme-muted">{k}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowUpRight size={12} className="theme-muted opacity-0 group-hover:opacity-100 transition" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
