import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useSettings } from '../settings';
import { useT } from '../i18n';
import { format } from 'date-fns';
import { Save, CheckCheck, Clock, FileText, Eye, Sidebar as SidebarIcon, PanelRight } from 'lucide-react';

export default function StatusBar() {
  const { current, saving, lastSavedAt, toggleSidebar } = useStore();
  const settings = useSettings((s) => s.settings);
  const { toggle } = useSettings();
  const t = useT();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const readingMin = current ? Math.max(1, Math.round(current.wordCount / 200)) : 0;

  return (
    <div className="h-6 border-t theme-border-soft theme-bg-soft flex items-center px-3 gap-3 text-[11px] theme-muted shrink-0">
      <button onClick={toggleSidebar} title={t('status.toggleSidebar')} className="hover:theme-text flex items-center gap-1">
        <SidebarIcon size={11} />
      </button>
      <button onClick={() => toggle('showRightPanel')} title={t('status.toggleInspector')} className={`hover:theme-text flex items-center gap-1 ${settings.showRightPanel ? 'theme-accent' : ''}`}>
        <PanelRight size={11} />
      </button>
      <button onClick={() => toggle('distractionFree')} title={t('status.distractionFree')} className={`hover:theme-text flex items-center gap-1 ${settings.distractionFree ? 'theme-accent' : ''}`}>
        <Eye size={11} />
      </button>
      <Sep />
      {current && settings.enableWordCount && (
        <span className="flex items-center gap-1">
          <FileText size={11} />
          {t('status.wordsChars', { w: current.wordCount.toLocaleString(), c: current.text.length.toLocaleString() })}
        </span>
      )}
      {current && settings.enableReadingTime && (
        <span className="flex items-center gap-1">
          <Clock size={11} /> {t('status.minRead', { n: readingMin })}
        </span>
      )}
      <div className="flex-1" />
      <SaveIndicator saving={saving} lastSavedAt={lastSavedAt} now={now} autoSave={settings.autoSave} t={t} />
      <span>{format(now, 'HH:mm')}</span>
    </div>
  );
}

function SaveIndicator({ saving, lastSavedAt, now, autoSave, t }: { saving: 'idle' | 'pending' | 'saved'; lastSavedAt: number | null; now: number; autoSave: boolean; t: (k: any, p?: any) => string }) {
  if (!autoSave) return <span className="theme-muted flex items-center gap-1"><Save size={11} /> {t('status.autoSaveOff')}</span>;
  if (saving === 'pending') return <span className="theme-muted flex items-center gap-1"><Save size={11} className="animate-pulse" /> {t('status.saving')}</span>;
  if (lastSavedAt) {
    const ago = Math.max(1, Math.round((now - lastSavedAt) / 1000));
    const agoStr = ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`;
    return <span className="theme-muted flex items-center gap-1"><CheckCheck size={11} className="text-green-500" /> {t('status.savedAgo', { ago: agoStr })}</span>;
  }
  return <span className="theme-muted flex items-center gap-1"><Save size={11} /> {t('status.ready')}</span>;
}

function Sep() {
  return <span className="theme-border w-px h-3 inline-block" />;
}
