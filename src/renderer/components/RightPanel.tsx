import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useSettings } from '../settings';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { useLabels } from '../labels';
import { tagPillStyle } from '../tagColors';
import { ChevronDown, ChevronRight, History, Link2, ListTree, Info, RotateCcw, Tag } from 'lucide-react';
import type { NoteMeta } from '../types';
import { findBacklinksAsync } from '../backlinks';

export default function RightPanel() {
  const { current, index, snapshots, restoreSnapshot, selectNote } = useStore();
  const settings = useSettings((s) => s.settings);
  const t = useT();
  const df = useDateFmt();
  const lbl = useLabels();
  const [openSec, setOpenSec] = useState({ info: true, toc: true, backlinks: true, history: true });

  if (!current) {
    return (
      <aside className="w-72 shrink-0 border-l theme-border-soft theme-bg-soft p-4 text-sm theme-muted">
        {t('right.empty')}
      </aside>
    );
  }

  const headings = useMemo(() => extractHeadings(current.content), [current.content]);
  const [backlinks, setBacklinks] = useState<NoteMeta[]>([]);
  const [scanningBacklinks, setScanningBacklinks] = useState(false);
  useEffect(() => {
    if (!settings.enableBacklinks) return;
    const ac = new AbortController();
    setBacklinks([]);
    setScanningBacklinks(true);
    void findBacklinksAsync(
      current.title,
      current.id,
      index.notes,
      (partial) => { if (!ac.signal.aborted) setBacklinks(partial); },
      ac.signal,
    ).finally(() => { if (!ac.signal.aborted) setScanningBacklinks(false); });
    return () => ac.abort();
  }, [current.title, current.id, current.updatedAt, index.notes, settings.enableBacklinks]);
  const notebook = index.notebooks.find((n) => n.id === current.notebookId);
  const readingMin = useMemo(() => Math.max(1, Math.round(current.wordCount / 200)), [current.wordCount]);

  return (
    <aside className="w-72 shrink-0 border-l theme-border-soft theme-bg-soft overflow-y-auto">
      <div className="px-3 py-3 border-b theme-border-soft">
        <h2 className="text-sm font-semibold theme-text truncate">{lbl.noteTitle(current.title)}</h2>
        <p className="text-xs theme-muted mt-0.5">{notebook ? lbl.notebookName(notebook.name) : ''}</p>
      </div>

      <Section
        icon={<Info size={13} />}
        title={t('right.info')}
        open={openSec.info}
        onToggle={() => setOpenSec((s) => ({ ...s, info: !s.info }))}
      >
        <Stat label={t('right.created')} value={df.full(current.createdAt)} />
        <Stat label={t('right.updated')} value={df.relative(current.updatedAt)} />
        {settings.enableWordCount && <Stat label={t('right.words')} value={current.wordCount.toLocaleString()} />}
        {settings.enableWordCount && <Stat label={t('right.characters')} value={current.text.length.toLocaleString()} />}
        {settings.enableReadingTime && <Stat label={t('right.readingTime')} value={t('right.minutes', { n: readingMin })} />}
        {current.tags.length > 0 && (
          <div className="px-3 py-2 flex flex-wrap gap-1">
            {current.tags.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" style={tagPillStyle(t)}>
                <Tag size={9} />{t}
              </span>
            ))}
          </div>
        )}
      </Section>

      {settings.enableTableOfContents && headings.length > 0 && (
        <Section
          icon={<ListTree size={13} />}
          title={t('right.outline', { n: headings.length })}
          open={openSec.toc}
          onToggle={() => setOpenSec((s) => ({ ...s, toc: !s.toc }))}
        >
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => scrollToHeading(h.text)}
              className="w-full text-left text-xs px-3 py-1 hover:theme-hover theme-text truncate block"
              style={{ paddingLeft: 12 + (h.level - 1) * 12 }}
            >
              {h.text || t('right.empty.outline')}
            </button>
          ))}
        </Section>
      )}

      {settings.enableBacklinks && (
        <Section
          icon={<Link2 size={13} />}
          title={t('right.backlinks', { n: backlinks.length })}
          open={openSec.backlinks}
          onToggle={() => setOpenSec((s) => ({ ...s, backlinks: !s.backlinks }))}
        >
          {backlinks.length === 0 ? (
            <p className="text-xs theme-muted px-3 py-2">
              {scanningBacklinks ? t('right.scanningBacklinks') : t('right.empty.backlinks')}
            </p>
          ) : (
            <>
              {backlinks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => void selectNote(b.id)}
                  className="w-full text-left text-xs px-3 py-1.5 hover:theme-hover theme-text truncate flex items-center gap-1.5"
                >
                  <Link2 size={11} className="theme-muted" />
                  <span className="truncate">{lbl.noteTitle(b.title)}</span>
                </button>
              ))}
              {scanningBacklinks && (
                <p className="text-[10px] theme-muted px-3 py-1 italic">{t('right.scanningBacklinks')}</p>
              )}
            </>
          )}
        </Section>
      )}

      {settings.enableNoteHistory && (
        <Section
          icon={<History size={13} />}
          title={t('right.history', { n: snapshots.length })}
          open={openSec.history}
          onToggle={() => setOpenSec((s) => ({ ...s, history: !s.history }))}
        >
          {snapshots.length === 0 ? (
            <p className="text-xs theme-muted px-3 py-2">{t('right.empty.history')}</p>
          ) : (
            snapshots.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:theme-hover">
                <span className="theme-muted flex-1 truncate">
                  {df.shortTime(s.takenAt)}
                </span>
                <button
                  onClick={() => {
                    if (confirm(t('right.confirmRestore'))) {
                      void restoreSnapshot(s.id);
                    }
                  }}
                  className="theme-muted hover:theme-text"
                  title={t('right.restoreSnap')}
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            ))
          )}
        </Section>
      )}
    </aside>
  );
}

function Section({ icon, title, open, onToggle, children }: { icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b theme-border-soft">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs uppercase tracking-wide theme-muted hover:theme-text"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{icon}</span>
        <span className="font-semibold">{title}</span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs">
      <span className="theme-muted">{label}</span>
      <span className="theme-text">{value}</span>
    </div>
  );
}

function extractHeadings(json: string): { level: number; text: string }[] {
  try {
    const doc = JSON.parse(json);
    const out: { level: number; text: string }[] = [];
    function walk(node: any) {
      if (!node) return;
      if (node.type === 'heading') {
        const text = (node.content ?? []).map((c: any) => c.text ?? '').join('');
        out.push({ level: node.attrs?.level ?? 1, text });
      }
      if (node.content) for (const c of node.content) walk(c);
    }
    walk(doc);
    return out;
  } catch {
    return [];
  }
}

function scrollToHeading(text: string) {
  const all = document.querySelectorAll('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3');
  for (const el of Array.from(all)) {
    if ((el.textContent ?? '').trim() === text.trim()) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('flash-highlight');
      setTimeout(() => el.classList.remove('flash-highlight'), 1500);
      return;
    }
  }
}
