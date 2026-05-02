import { useEffect, useRef, useState } from 'react';
import { Zap, Pause, Play, X, Scissors, FileText, Clock } from 'lucide-react';
import { useStore } from '../store';

/**
 * Flux mode — distraction-free Pomodoro writing.
 *
 * Hides the rest of the UI, shows a single big textarea + a 25-minute timer.
 * When the timer reaches zero (or the user clicks "Terminer"), we propose to
 * split the buffer into multiple notes. The split heuristic is paragraph-based
 * with a "topic-shift" detector (a blank line followed by a heading-like line
 * or a `===` separator counts as a topic boundary).
 *
 * The user reviews the proposed split, can rename/merge/delete buckets, then
 * we create one note per accepted bucket in the current notebook.
 */

const DEFAULT_DURATION_MS = 25 * 60 * 1000;

export default function FluxMode({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(DEFAULT_DURATION_MS);
  const [phase, setPhase] = useState<'writing' | 'review'>('writing');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Timer
  useEffect(() => {
    if (phase !== 'writing' || paused) return;
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1000) {
          if (tickRef.current) clearInterval(tickRef.current);
          setPhase('review');
          return 0;
        }
        return r - 1000;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [phase, paused]);

  useEffect(() => { taRef.current?.focus(); }, []);

  // Esc → confirm exit (don't lose work by accident)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (phase === 'review') return; // review owns its own UI
        if (text.trim() && !confirm('Quitter le mode Flux ? Ton texte sera perdu si tu n\'as pas lancé la création des notes.')) return;
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [text, phase, onClose]);

  function finishEarly() {
    if (!text.trim()) {
      onClose();
      return;
    }
    if (tickRef.current) clearInterval(tickRef.current);
    setPhase('review');
  }

  if (phase === 'review') {
    return <FluxReview text={text} onCancel={() => setPhase('writing')} onClose={onClose} />;
  }

  const min = Math.floor(remaining / 60000);
  const sec = Math.floor((remaining % 60000) / 1000);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-[60] theme-bg flex flex-col">
      <div className="px-6 py-3 border-b theme-border-soft flex items-center gap-3">
        <Zap size={16} className="theme-accent" />
        <h2 className="font-semibold theme-text text-sm">Mode Flux</h2>
        <div className="ml-auto flex items-center gap-3 text-xs theme-muted">
          <span className="flex items-center gap-1.5 tabular-nums">
            <Clock size={12} />
            <span className={`font-mono font-bold ${remaining < 60000 ? 'text-red-500' : 'theme-text'}`}>
              {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
            </span>
          </span>
          <span>{wordCount} mots</span>
          <button
            onClick={() => setPaused((p) => !p)}
            className="theme-muted hover:theme-text p-1 rounded"
            title={paused ? 'Reprendre' : 'Pause'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            onClick={finishEarly}
            className="text-xs px-3 py-1 rounded theme-accent-bg text-white hover:opacity-90"
          >
            Terminer maintenant
          </button>
          <button onClick={onClose} className="theme-muted hover:theme-text p-1 rounded">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris en continu. N'organise pas. Pense plus tard.&#10;&#10;Astuce : tape === sur une ligne pour signaler un changement de sujet — ça aidera le découpage automatique."
          className="flex-1 w-full bg-transparent outline-none resize-none px-12 py-8 theme-text text-lg leading-relaxed placeholder:theme-muted"
          style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}
        />
      </div>

      <div className="px-6 py-2 border-t theme-border-soft text-xs theme-muted flex items-center justify-between">
        <span>Échap pour quitter · Pause possible · {paused ? '⏸ En pause' : '▶ En cours'}</span>
        <span>Le découpage automatique se déclenchera à la fin du timer ou quand tu cliques « Terminer ».</span>
      </div>
    </div>
  );
}

/**
 * Splits a free-form text into "buckets" using paragraph + topic-shift hints.
 * - `===` on its own line is an explicit boundary
 * - A blank-line gap before a line that LOOKS like a heading (Title Case, ≤8 words)
 *   counts as a soft boundary
 * - Otherwise paragraphs separated by blank lines stay in the same bucket
 *   unless that bucket already has ≥6 paragraphs (avoid one giant note).
 */
function autoSplit(text: string): { title: string; body: string }[] {
  const lines = text.split('\n');
  const buckets: string[][] = [[]];
  let lastWasBlank = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '===') {
      buckets.push([]);
      lastWasBlank = false;
      continue;
    }
    const isBlank = line.trim() === '';
    if (isBlank) {
      lastWasBlank = true;
      buckets[buckets.length - 1].push('');
      continue;
    }
    if (lastWasBlank && looksLikeHeading(line)) {
      const cur = buckets[buckets.length - 1];
      // If current bucket already has content, start a new one
      if (cur.some((l) => l.trim().length > 0)) buckets.push([]);
    }
    buckets[buckets.length - 1].push(line);
    lastWasBlank = false;
  }

  const result: { title: string; body: string }[] = [];
  for (const b of buckets) {
    const body = b.join('\n').trim();
    if (!body) continue;
    const firstNonEmpty = body.split('\n').find((l) => l.trim().length > 0) || 'Note Flux';
    const title = firstNonEmpty.replace(/^#+\s*/, '').slice(0, 60).trim();
    result.push({ title: title || 'Note Flux', body });
  }
  if (result.length === 0 && text.trim()) {
    return [{ title: 'Session Flux', body: text.trim() }];
  }
  return result;
}

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.startsWith('#')) return true;
  if (t.length > 80) return false;
  if (t.endsWith('.') || t.endsWith('?') || t.endsWith('!')) return false;
  const words = t.split(/\s+/);
  if (words.length > 8) return false;
  // Crude "starts with capital and has mostly capitalized words" heuristic
  const firstChar = t[0];
  if (!firstChar || firstChar !== firstChar.toUpperCase()) return false;
  return true;
}

function FluxReview({ text, onCancel, onClose }: { text: string; onCancel: () => void; onClose: () => void }) {
  const { index, view, refresh, toast } = useStore();
  const [buckets, setBuckets] = useState(() => autoSplit(text));
  const [creating, setCreating] = useState(false);

  function updateTitle(i: number, title: string) {
    setBuckets((bs) => bs.map((b, j) => (j === i ? { ...b, title } : b)));
  }
  function remove(i: number) {
    setBuckets((bs) => bs.filter((_, j) => j !== i));
  }
  function mergeWithPrev(i: number) {
    if (i === 0) return;
    setBuckets((bs) => {
      const next = bs.slice();
      next[i - 1] = { title: next[i - 1].title, body: `${next[i - 1].body}\n\n${next[i].body}` };
      next.splice(i, 1);
      return next;
    });
  }

  async function createNotes() {
    if (creating || buckets.length === 0) return;
    setCreating(true);
    try {
      // Pick a notebook: the current one if we're in a notebook view,
      // else the first available.
      const nbId = view.kind === 'notebook' ? view.id : (index.notebooks[0]?.id ?? 'inbox');
      let created = 0;
      for (const b of buckets) {
        if (!b.body.trim()) continue;
        // Tiptap doc shape: paragraphs split by blank lines
        const paragraphs = b.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        const content = JSON.stringify({
          type: 'doc',
          content: paragraphs.length === 0
            ? [{ type: 'paragraph' }]
            : paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
        });
        const note = await window.nv.createNote(nbId, { title: b.title.trim() || 'Note Flux', content });
        await window.nv.saveNote({ id: note.id, text: b.body, tags: ['flux'] });
        created++;
      }
      await refresh();
      toast('success', `${created} note${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''} depuis ta session Flux`);
      onClose();
    } catch (e) {
      toast('error', `Erreur : ${String(e)}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] theme-bg flex flex-col">
      <div className="px-6 py-3 border-b theme-border-soft flex items-center gap-3">
        <Scissors size={16} className="theme-accent" />
        <h2 className="font-semibold theme-text text-sm">Découpage Flux — vérifie avant de créer les notes</h2>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded theme-muted hover:theme-text"
          >
            ← Continuer d'écrire
          </button>
          <button
            onClick={() => void createNotes()}
            disabled={creating || buckets.length === 0}
            className="text-xs px-3 py-1 rounded theme-accent-bg text-white hover:opacity-90 disabled:opacity-40"
          >
            {creating ? 'Création…' : `Créer ${buckets.length} note${buckets.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {buckets.length === 0 ? (
            <div className="text-center theme-muted py-12">
              Pas de contenu à découper. Reviens écrire ou ferme.
            </div>
          ) : (
            buckets.map((b, i) => (
              <div key={i} className="theme-card border theme-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="theme-muted shrink-0" />
                  <input
                    value={b.title}
                    onChange={(e) => updateTitle(i, e.target.value)}
                    className="flex-1 bg-transparent outline-none theme-text font-semibold"
                    placeholder="Titre de la note"
                  />
                  {i > 0 && (
                    <button
                      onClick={() => mergeWithPrev(i)}
                      className="text-[10px] theme-muted hover:theme-text px-2 py-1 rounded"
                      title="Fusionner avec la note précédente"
                    >
                      ↑ Fusionner
                    </button>
                  )}
                  <button
                    onClick={() => remove(i)}
                    className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded"
                  >
                    Retirer
                  </button>
                </div>
                <div className="text-xs theme-muted whitespace-pre-wrap leading-relaxed line-clamp-6">
                  {b.body}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
