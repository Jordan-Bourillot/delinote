import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { Search, Replace, X, ChevronUp, ChevronDown, CaseSensitive } from 'lucide-react';

export default function FindReplace() {
  const closeModal = useStore((s) => s.closeModal);
  const { current, patchCurrent } = useStore();
  const t = useT();
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [whole, setWhole] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const matches = useMemo(() => {
    if (!current || !query) return [];
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = whole ? `\\b${escaped}\\b` : escaped;
    try {
      const re = new RegExp(pattern, flags);
      const out: { start: number; end: number }[] = [];
      let m;
      while ((m = re.exec(current.text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      return out;
    } catch {
      return [];
    }
  }, [current?.text, query, caseSensitive, whole]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  function jumpTo(idx: number) {
    if (!matches[idx] || !current) return;
    const m = matches[idx];
    const snippet = current.text.slice(Math.max(0, m.start - 30), m.start + 30);
    // Find span in DOM and scroll
    const editorEl = document.querySelector('.ProseMirror');
    if (editorEl && snippet) {
      const range = document.createRange();
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
      let charsLeft = m.start;
      let node = walker.nextNode();
      while (node) {
        const len = node.nodeValue?.length ?? 0;
        if (len >= charsLeft) {
          try {
            range.setStart(node, Math.max(0, charsLeft));
            range.setEnd(node, Math.min(len, charsLeft + (m.end - m.start)));
            const rect = range.getBoundingClientRect();
            (editorEl as HTMLElement).scrollTo({
              top: (editorEl as HTMLElement).scrollTop + rect.top - 200,
              behavior: 'smooth',
            });
          } catch { /* ignore */ }
          return;
        }
        charsLeft -= len;
        node = walker.nextNode();
      }
    }
  }

  function doReplaceAll() {
    if (!current || !query) return;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = whole ? `\\b${escaped}\\b` : escaped;
    let re: RegExp;
    try { re = new RegExp(pattern, flags); } catch { return; }
    // Replace plain text — but we need to update the editor content.
    // Simplest reliable approach: walk JSON and replace text nodes.
    try {
      const doc = JSON.parse(current.content);
      let count = 0;
      function walk(node: any) {
        if (!node) return;
        if (node.type === 'text' && typeof node.text === 'string') {
          const replaced = node.text.replace(re, () => { count++; return replace; });
          node.text = replaced;
        }
        if (node.content) for (const c of node.content) walk(c);
      }
      walk(doc);
      const newContent = JSON.stringify(doc);
      const newText = current.text.replace(re, replace);
      patchCurrent({ content: newContent, text: newText });
      useStore.getState().toast('success', t('find.replaced', { n: count }));
    } catch {
      useStore.getState().toast('error', t('find.failed'));
    }
  }

  return (
    <div
      className="fixed top-16 right-6 z-40 theme-card rounded-lg shadow-2xl border theme-border w-96 overflow-hidden"
    >
      <div className="flex items-center gap-1 px-2 py-1.5 border-b theme-border-soft">
        <Search size={13} className="theme-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('find.find')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const next = e.shiftKey ? Math.max(0, activeIdx - 1) : Math.min(matches.length - 1, activeIdx + 1);
              setActiveIdx(next);
              jumpTo(next);
            }
            else if (e.key === 'Escape') closeModal();
          }}
          className="flex-1 bg-transparent outline-none text-sm theme-text"
        />
        <span className="text-[10px] theme-muted px-1">
          {matches.length === 0 ? '0' : `${activeIdx + 1}/${matches.length}`}
        </span>
        <button title={t('find.previous')} onClick={() => { const i = Math.max(0, activeIdx - 1); setActiveIdx(i); jumpTo(i); }} className="theme-muted hover:theme-text p-1">
          <ChevronUp size={13} />
        </button>
        <button title={t('find.next')} onClick={() => { const i = Math.min(matches.length - 1, activeIdx + 1); setActiveIdx(i); jumpTo(i); }} className="theme-muted hover:theme-text p-1">
          <ChevronDown size={13} />
        </button>
        <button title={t('find.case')} onClick={() => setCaseSensitive(!caseSensitive)} className={`p-1 rounded ${caseSensitive ? 'theme-accent-bg text-white' : 'theme-muted hover:theme-text'}`}>
          <CaseSensitive size={13} />
        </button>
        <button title={t('find.whole')} onClick={() => setWhole(!whole)} className={`px-1 text-[10px] font-bold rounded ${whole ? 'theme-accent-bg text-white' : 'theme-muted hover:theme-text'}`}>
          W
        </button>
        <button onClick={closeModal} className="theme-muted hover:theme-text p-1"><X size={13} /></button>
      </div>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Replace size={13} className="theme-muted" />
        <input
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          placeholder={t('find.replace')}
          className="flex-1 bg-transparent outline-none text-sm theme-text"
        />
        <button onClick={doReplaceAll} className="text-xs text-white px-2 py-1 rounded theme-accent-bg hover:opacity-90">
          {t('find.replaceAll')}
        </button>
      </div>
    </div>
  );
}
