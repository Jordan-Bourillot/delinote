import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { useLabels } from '../labels';
import { Paperclip, FileText, Image as ImageIcon, FileVideo, FileAudio, FileArchive, ArrowRight, Search } from 'lucide-react';

type FileEntry = {
  noteId: string;
  noteTitle: string;
  attachmentId: string;
  filename: string;
  mime: string;
  size: number;
  addedAt: number;
};

export default function FilesView() {
  const { index, selectNote, openTab } = useStore();
  const t = useT();
  const df = useDateFmt();
  const lbl = useLabels();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [query, setQuery] = useState('');

  // Walk every note's content, collect attachment nodes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: FileEntry[] = [];
      for (const meta of index.notes) {
        if (meta.trashed) continue;
        const note = await window.nv.getNote(meta.id);
        if (!note) continue;
        try {
          const doc = JSON.parse(note.content);
          collectAttachments(doc, (a) => {
            all.push({
              noteId: note.id,
              noteTitle: lbl.noteTitle(note.title),
              attachmentId: a.attachmentId,
              filename: a.filename,
              mime: a.mime,
              size: a.size,
              addedAt: note.updatedAt,
            });
          });
        } catch { /* ignore */ }
        if (cancelled) return;
      }
      if (!cancelled) setFiles(all);
    })();
    return () => { cancelled = true; };
  }, [index.notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q ? files : files.filter((f) => f.filename.toLowerCase().includes(q) || f.noteTitle.toLowerCase().includes(q));
    return list.sort((a, b) => b.addedAt - a.addedAt);
  }, [files, query]);

  return (
    <div className="flex-1 overflow-y-auto theme-bg">
      <div className="max-w-4xl mx-auto px-8 pt-8 pb-12">
        <header className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Paperclip size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold theme-text">{t('files.title')}</h1>
            <p className="text-xs theme-muted">{files.length} fichier{files.length > 1 ? 's' : ''} · {totalSize(files)}</p>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 theme-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sidebar.search')}
              className="theme-input rounded pl-7 pr-3 py-1.5 text-sm w-48"
            />
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="theme-card-soft rounded-xl px-6 py-10 text-center border theme-border-soft border-dashed">
            <Paperclip size={28} className="mx-auto theme-muted mb-3 opacity-50" />
            <p className="text-sm theme-text">{t('files.empty')}</p>
          </div>
        ) : (
          <div className="theme-card rounded-xl border theme-border-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="theme-bg-soft text-left text-[10px] uppercase tracking-wider theme-muted">
                <tr>
                  <th className="py-2 px-3 font-semibold">{t('files.title')}</th>
                  <th className="py-2 px-3 font-semibold">{t('files.size')}</th>
                  <th className="py-2 px-3 font-semibold">{t('files.added')}</th>
                  <th className="py-2 px-3 font-semibold"></th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={`${f.noteId}-${f.attachmentId}`} className="border-t theme-border-soft hover:theme-hover group">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="theme-muted shrink-0">{iconFor(f.mime)}</span>
                        <button
                          onClick={() => void window.nv.openAttachment(f.noteId, f.attachmentId, f.filename)}
                          className="theme-text hover:underline truncate text-left"
                        >
                          {f.filename}
                        </button>
                      </div>
                      <div className="text-[10px] theme-muted mt-0.5">{t('files.fromNote', { note: f.noteTitle })}</div>
                    </td>
                    <td className="py-2 px-3 theme-muted text-xs">{formatBytes(f.size)}</td>
                    <td className="py-2 px-3 theme-muted text-xs">{df.short(f.addedAt)}</td>
                    <td className="py-2 px-3 theme-muted text-xs uppercase">{(f.mime.split('/')[1] ?? '?').slice(0, 6)}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => { void selectNote(f.noteId); openTab(f.noteId); }}
                        title={t('tasks.openNote')}
                        className="opacity-0 group-hover:opacity-100 theme-muted hover:theme-text p-1"
                      >
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return <ImageIcon size={14} />;
  if (mime.startsWith('video/')) return <FileVideo size={14} />;
  if (mime.startsWith('audio/')) return <FileAudio size={14} />;
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return <FileArchive size={14} />;
  return <FileText size={14} />;
}

function collectAttachments(node: any, onAttach: (a: { attachmentId: string; filename: string; mime: string; size: number }) => void) {
  if (!node) return;
  if (node.type === 'attachment' && node.attrs) {
    onAttach({
      attachmentId: node.attrs.attachmentId,
      filename: node.attrs.filename,
      mime: node.attrs.mime,
      size: node.attrs.size,
    });
  }
  if (Array.isArray(node.content)) for (const c of node.content) collectAttachments(c, onAttach);
}

function formatBytes(n: number) {
  if (!n) return '—';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function totalSize(files: { size: number }[]): string {
  const t = files.reduce((s, f) => s + f.size, 0);
  return formatBytes(t);
}
