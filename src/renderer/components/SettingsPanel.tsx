import { useEffect, useRef, useState } from 'react';
import { useSettings, FEATURE_CATEGORIES, DEFAULT_SETTINGS } from '../settings';
import type { Settings } from '../settings';
import { useStore } from '../store';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { X, RotateCcw, Download, Upload, Folder, FolderOpen, Sparkles, Check, Sprout, Zap, Rocket, Wand2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { TriskellMark } from './TriskellMark';
import { applyProfile, detectCurrentProfile, type ProfileId } from '../profiles';
import { useUpdateStatus } from './UpdateBanner';
import LabSection from './LabSection';
import GiftReferralSection from './GiftReferralSection';

export default function SettingsPanel() {
  const { settings, set, toggle, reset, exportToJSON, importFromJSON } = useSettings();
  const closeModal = useStore((s) => s.closeModal);
  const toast = useStore((s) => s.toast);
  const t = useT();
  const [section, setSection] = useState<string>('profile');

  // Snapshot the settings the moment the panel opens. If the user clicks
  // "Annuler", we revert any live-previewed changes back to this snapshot.
  const snapshotRef = useRef<Settings | null>(null);
  useEffect(() => {
    if (!snapshotRef.current) snapshotRef.current = { ...settings };
  }, []);
  const dirty = snapshotRef.current && JSON.stringify(snapshotRef.current) !== JSON.stringify(settings);

  function saveAndClose() {
    snapshotRef.current = { ...settings };
    toast('success', t('settings.savedToast'));
    closeModal();
  }
  function cancelAndClose() {
    if (snapshotRef.current) {
      const snap = snapshotRef.current;
      // Reset all keys to the snapshot values
      (Object.keys(snap) as (keyof Settings)[]).forEach((k) => set(k, (snap as any)[k]));
    }
    closeModal();
  }

  const sections: { id: string; label: string }[] = [
    { id: 'profile', label: 'Profil d\'utilisation' },
    { id: 'appearance', label: t('settings.appearance') },
    ...FEATURE_CATEGORIES.map((c) => ({ id: c.id, label: t(c.labelKey as StringKey) })),
    { id: 'lab', label: '🧪 Labo' },
    { id: 'gift', label: '🎁 Offrir & parrainer' },
    { id: 'data', label: t('settings.dataBackup') },
    { id: 'updates', label: 'Mises à jour' },
    { id: 'about', label: t('settings.about') },
  ];

  return (
    <Modal onClose={cancelAndClose} title={t('settings.title')} wide>
      <div className="flex h-[600px] max-h-[calc(100vh-200px)]">
        <nav className="w-52 shrink-0 border-r theme-border-soft py-2 overflow-y-auto">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full text-left px-4 py-2 text-sm transition ${
                section === s.id ? 'theme-accent-bg theme-text font-medium' : 'theme-muted hover:theme-hover hover:theme-text'
              }`}
            >
              {s.label}
            </button>
          ))}
          <div className="px-4 mt-4 pt-4 border-t theme-border-soft space-y-1.5">
            <button
              onClick={() => {
                if (confirm(t('settings.confirmReset'))) {
                  reset();
                  toast('success', t('settings.resetDone'));
                }
              }}
              className="w-full text-xs flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-500/10"
            >
              <RotateCcw size={12} /> {t('settings.reset')}
            </button>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {section === 'profile' && <ProfileSection />}
          {section === 'appearance' && <AppearanceSection settings={settings} set={set} />}
          {section === 'lab' && <LabSection />}
          {section === 'gift' && <GiftReferralSection />}
          {section === 'data' && (
            <DataSection
              exportSettings={() => {
                const json = exportToJSON();
                navigator.clipboard.writeText(json);
                toast('success', t('toast.settingsCopied'));
              }}
              importSettings={() => {
                const txt = window.prompt('Paste settings JSON');
                if (txt && importFromJSON(txt)) toast('success', t('toast.settingsImported'));
                else if (txt) toast('error', t('toast.invalidJson'));
              }}
            />
          )}
          {section === 'updates' && <UpdatesSection />}
          {section === 'about' && <AboutSection />}
          {FEATURE_CATEGORIES.filter((c) => c.id === section).map((cat) => (
            <div key={cat.id}>
              <h3 className="text-lg font-semibold theme-text mb-1">{t(cat.labelKey as StringKey)}</h3>
              <p className="text-sm theme-muted mb-5">{t('settings.toggleHint')}</p>
              <div className="space-y-1">
                {cat.toggles.map((tg) => (
                  <Toggle
                    key={tg.key}
                    label={t(tg.labelKey as StringKey)}
                    hint={tg.hintKey ? t(tg.hintKey as StringKey) : undefined}
                    checked={settings[tg.key] as boolean}
                    onChange={() => toggle(tg.key)}
                  />
                ))}
              </div>
              {cat.id === 'note' && (
                <div className="mt-6 pt-6 border-t theme-border-soft space-y-4">
                  <NumberField label={t('settings.maxSnapshots')} value={settings.historyMaxSnapshots} onChange={(v) => set('historyMaxSnapshots', v)} min={5} max={200} />
                </div>
              )}
              {cat.id === 'sidebar' && (
                <div className="mt-6 pt-6 border-t theme-border-soft space-y-4">
                  <NumberField label={t('settings.recentCount')} value={settings.recentCount} onChange={(v) => set('recentCount', v)} min={1} max={20} />
                </div>
              )}
              {cat.id === 'app' && (
                <div className="mt-6 pt-6 border-t theme-border-soft space-y-4">
                  <NumberField label={t('settings.autoSaveDelay')} value={settings.autoSaveDebounceMs} onChange={(v) => set('autoSaveDebounceMs', v)} min={100} max={5000} step={100} />
                </div>
              )}
              {cat.id === 'list' && (
                <div className="mt-6 pt-6 border-t theme-border-soft space-y-4">
                  <SelectField label={t('settings.sortBy')} value={settings.notesSortBy} onChange={(v) => set('notesSortBy', v as Settings['notesSortBy'])} options={[
                    { v: 'updated', l: t('settings.sortByUpdated') },
                    { v: 'created', l: t('settings.sortByCreated') },
                    { v: 'title', l: t('settings.sortByTitle') },
                  ]} />
                  <SelectField label={t('settings.sortOrder')} value={settings.notesSortOrder} onChange={(v) => set('notesSortOrder', v as Settings['notesSortOrder'])} options={[
                    { v: 'desc', l: t('settings.sortNewest') },
                    { v: 'asc', l: t('settings.sortOldest') },
                  ]} />
                  <SelectField label={t('settings.listDensity')} value={settings.listDensity} onChange={(v) => set('listDensity', v as Settings['listDensity'])} options={[
                    { v: 'comfortable', l: t('list.comfortable') },
                    { v: 'compact', l: t('list.compact') },
                  ]} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Footer: Cancel reverts, Save confirms — even though changes apply
          live, this gives explicit control + a "you're done" close action. */}
      <div className="flex items-center justify-between px-4 py-3 border-t theme-border-soft theme-bg-soft">
        <div className="text-xs theme-muted">
          {dirty ? t('settings.dirty') : t('settings.allSaved')}
        </div>
        <div className="flex gap-2">
          <button
            onClick={cancelAndClose}
            className="text-sm px-3 py-1.5 rounded-lg theme-muted hover:theme-text hover:theme-hover"
          >
            {t('settings.cancel')}
          </button>
          <button
            onClick={saveAndClose}
            className="text-sm px-4 py-1.5 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1.5"
          >
            <Check size={13} /> {t('settings.saveClose')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AppearanceSection({ settings, set }: { settings: Settings; set: any }) {
  const t = useT();
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold theme-text mb-4 flex items-center gap-2">
          <Sparkles size={16} /> {t('settings.appearance')}
        </h3>
        <SelectField
          label={t('settings.language')}
          value={settings.language}
          onChange={(v) => set('language', v)}
          options={[
            { v: 'en', l: t('settings.langEn') },
            { v: 'fr', l: t('settings.langFr') },
          ]}
        />
        <div className="flex items-center justify-between py-2.5 gap-4">
          <label className="text-sm theme-text">{t('settings.firstName')}</label>
          <input
            value={settings.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            placeholder={t('settings.firstNamePh')}
            maxLength={40}
            className="theme-input rounded px-2 py-1 text-sm outline-none w-48"
          />
        </div>
        <SelectField
          label={t('settings.theme')}
          value={settings.theme}
          onChange={(v) => set('theme', v)}
          options={[
            { v: 'caribbean', l: t('settings.themeCaribbean') },
            { v: 'light', l: t('settings.themeLight') },
            { v: 'dark', l: t('settings.themeDark') },
            { v: 'sepia', l: t('settings.themeSepia') },
          ]}
        />
        <SelectField label={t('settings.editorWidth')} value={settings.editorWidth} onChange={(v) => set('editorWidth', v)} options={[
          { v: 'narrow', l: t('settings.widthNarrow') },
          { v: 'wide', l: t('settings.widthWide') },
          { v: 'full', l: t('settings.widthFull') },
        ]} />
        <SelectField label={t('settings.fontFamily')} value={settings.fontFamily} onChange={(v) => set('fontFamily', v)} options={[
          { v: 'sans', l: t('settings.fontSans') },
          { v: 'serif', l: t('settings.fontSerif') },
          { v: 'mono', l: t('settings.fontMono') },
        ]} />
        <NumberField label={t('settings.fontSize')} value={settings.fontSize} onChange={(v) => set('fontSize', v)} min={12} max={24} />
        <ColorField
          label={t('settings.accent')}
          value={settings.accentColor}
          onChange={(v) => set('accentColor', v)}
          presets={['#F37223', '#1B2330', '#0d9488', '#0ea5e9', '#fbbf24', '#a855f7', '#fb7185']}
        />
        <BackgroundImageField
          imageDataUrl={settings.backgroundImage}
          opacity={settings.backgroundOpacity}
          onImageChange={(v) => set('backgroundImage', v)}
          onOpacityChange={(v) => set('backgroundOpacity', v)}
        />
      </div>
    </div>
  );
}

function BackgroundImageField({
  imageDataUrl,
  opacity,
  onImageChange,
  onOpacityChange,
}: {
  imageDataUrl: string;
  opacity: number;
  onImageChange: (v: string) => void;
  onOpacityChange: (v: number) => void;
}) {
  const toast = useStore((s) => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pickFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast('error', 'Le fichier sélectionné n\'est pas une image.');
      return;
    }
    // Downscale to ≤1920px wide so a 4 K photo doesn't blow past localStorage
    // (settings live there) — most JPEGs land ≈400-800 KB after re-encode.
    try {
      const dataUrl = await downscaleImageToDataUrl(file, 1920, 0.85);
      onImageChange(dataUrl);
      toast('success', 'Image de fond appliquée.');
    } catch (e) {
      toast('error', `Impossible de charger l'image : ${String(e)}`);
    }
  }

  return (
    <div className="py-2.5 space-y-2.5 border-t theme-border-soft mt-2 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label className="text-sm theme-text font-medium">Image de fond</label>
          <p className="text-xs theme-muted mt-0.5">
            Une photo personnelle en arrière-plan de l'app. Joue avec l'opacité pour la rendre discrète.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {imageDataUrl ? (
            <>
              <div
                className="w-12 h-9 rounded border theme-border-soft bg-cover bg-center"
                style={{ backgroundImage: `url(${imageDataUrl})` }}
                aria-label="Aperçu"
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="text-xs theme-muted hover:theme-text px-2 py-1 rounded theme-input"
              >
                Changer
              </button>
              <button
                onClick={() => onImageChange('')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded"
              >
                Retirer
              </button>
            </>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs theme-muted hover:theme-text px-2 py-1 rounded theme-input"
            >
              Choisir une image…
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {imageDataUrl && (
        <div className="flex items-center gap-3">
          <label className="text-xs theme-muted shrink-0 w-20">Opacité</label>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs theme-text tabular-nums w-10 text-right">{opacity}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Read a File, draw it on a canvas no wider than `maxWidth`, return a JPEG
 * data URL. Aspect ratio is preserved. Used to keep background images small
 * enough to fit in localStorage settings.
 */
async function downscaleImageToDataUrl(file: File, maxWidth: number, quality: number): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image illisible'));
      i.src = blobUrl;
    });
    const ratio = Math.min(1, maxWidth / img.naturalWidth);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas non disponible');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function DataSection({ exportSettings, importSettings }: { exportSettings: () => void; importSettings: () => void }) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [dataDir, setDataDir] = useState('');

  async function copyDataDir() {
    const d = await window.nv.dataDir();
    setDataDir(d);
    navigator.clipboard.writeText(d);
    toast('success', t('toast.dataPathCopied'));
  }
  async function openDataDir() {
    const d = await window.nv.dataDir();
    await window.nv.openPath(d);
  }
  async function exportAll() {
    const r = await window.nv.exportAll();
    if (r.ok) toast('success', t('toast.exportedTo', { path: r.path }));
  }
  async function importAll() {
    if (!confirm(t('settings.confirmImportReplace'))) return;
    const r = await window.nv.importAll();
    if (r.ok) {
      toast('success', t('toast.importedN', { n: r.imported }));
      await useStore.getState().refresh();
    } else if (r.reason !== 'cancelled') toast('error', t('toast.importFailed', { reason: r.reason }));
  }
  async function backupNow() {
    const r = await window.nv.backupNow();
    if (r.ok) toast('success', t('toast.backupTo', { path: r.path }));
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold theme-text mb-1">{t('settings.dataBackup')}</h3>
      <p className="text-sm theme-muted">{t('settings.dataIntro')}</p>

      <Card>
        <CardRow title={t('settings.dataFolder')} subtitle={dataDir || t('settings.dataFolderHint')}
          actions={<div className="flex gap-1">
            <SmallBtn onClick={openDataDir}><FolderOpen size={12} /> {t('settings.openFolder')}</SmallBtn>
            <SmallBtn onClick={copyDataDir}><Folder size={12} /> {t('settings.copyPath')}</SmallBtn>
          </div>} />
      </Card>

      <Card title={t('settings.backup')}>
        <CardRow title={t('settings.backupNow')} subtitle={t('settings.backupNowHint')}
          actions={<SmallBtn onClick={backupNow}><Download size={12} /> {t('settings.backup')}</SmallBtn>} />
        <CardRow title={t('settings.exportAll')} subtitle={t('settings.exportAllHint')}
          actions={<SmallBtn onClick={exportAll}><Download size={12} /> {t('settings.export')}</SmallBtn>} />
        <CardRow title={t('settings.importBundle')} subtitle={t('settings.importBundleHint')}
          actions={<SmallBtn onClick={importAll} danger><Upload size={12} /> {t('settings.import')}</SmallBtn>} />
      </Card>

      <Card title="Importer depuis une autre application">
        <CardRow
          title="Importer Evernote (.enex)"
          subtitle="Sélectionne un fichier .enex exporté depuis Evernote."
          actions={<SmallBtn onClick={async () => {
            const r = await window.nv.importEnex();
            if (r.ok) { toast('success', `${r.imported} notes importées depuis Evernote`); await useStore.getState().refresh(); }
            else if (r.reason !== 'cancelled') toast('error', `Échec : ${r.reason}`);
          }}><Upload size={12} /> ENEX</SmallBtn>}
        />
        <CardRow
          title="Importer un dossier de notes"
          subtitle="Obsidian, Notion (export ZIP décompressé), Bear, Joplin, Apple Notes… — tout dossier contenant des .md / .txt."
          actions={<SmallBtn onClick={async () => {
            const r = await window.nv.importFolder();
            if (r.ok) { toast('success', `${r.imported} fichiers importés`); await useStore.getState().refresh(); }
            else if (r.reason !== 'cancelled') toast('error', `Échec : ${r.reason}`);
          }}><Upload size={12} /> Dossier</SmallBtn>}
        />
        <CardRow
          title="Importer des PDFs"
          subtitle="Sélectionne un ou plusieurs PDFs — le texte est extrait et chaque PDF devient une note."
          actions={<SmallBtn onClick={async () => {
            const r = await window.nv.importPdfs();
            if (r.ok) { toast('success', `${r.imported} PDF(s) importés`); await useStore.getState().refresh(); }
            else if (r.reason !== 'cancelled') toast('error', `Échec : ${r.reason}`);
          }}><Upload size={12} /> PDF</SmallBtn>}
        />
      </Card>

      <Card title={t('settings.title')}>
        <CardRow title={t('settings.exportSettings')} subtitle={t('settings.exportSettingsHint')}
          actions={<SmallBtn onClick={exportSettings}><Download size={12} /> {t('settings.copy')}</SmallBtn>} />
        <CardRow title={t('settings.importSettings')} subtitle={t('settings.importSettingsHint')}
          actions={<SmallBtn onClick={importSettings}><Upload size={12} /> {t('settings.paste')}</SmallBtn>} />
      </Card>
    </div>
  );
}

function AboutSection() {
  const t = useT();
  return (
    <div className="space-y-3 max-w-md">
      <h3 className="text-lg font-semibold theme-text mb-2">{t('settings.aboutTitle')}</h3>
      <p className="text-sm theme-muted">{t('settings.aboutBody')}</p>
      <ul className="text-sm theme-text space-y-1 mt-3">
        <li>• {t('settings.aboutB1')}</li>
        <li>• {t('settings.aboutB2')}</li>
        <li>• {t('settings.aboutB3')}</li>
        <li>• {t('settings.aboutB4')}</li>
        <li>• {t('settings.aboutB5')}</li>
        <li>• {t('settings.aboutB6')}</li>
      </ul>
      <p className="text-xs theme-muted mt-4">v{__APP_VERSION__} — {t('settings.aboutVersionSuffix')}</p>
      <div className="mt-6 pt-5 border-t theme-border-soft flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-white border theme-border-soft shadow-sm">
          <TriskellMark size={22} />
        </div>
        <div className="text-sm theme-text leading-snug">
          {t('studio.thanks')}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-3 py-2 px-2 rounded hover:theme-hover cursor-pointer transition">
      <button
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(); }}
        className={`w-9 h-5 rounded-full relative transition mt-0.5 shrink-0 ${checked ? 'theme-accent-bg' : 'theme-toggle-off'}`}
      >
        <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm theme-text leading-tight">{label}</div>
        {hint && <div className="text-xs theme-muted mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <label className="text-sm theme-text">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="theme-input rounded px-2 py-1 text-sm outline-none min-w-[160px]">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <label className="text-sm theme-text">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} step={step} className="theme-input rounded px-2 py-1 text-sm outline-none w-24 text-right" />
    </div>
  );
}

function RangeField({ label, value, onChange, min, max, step, format }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: (v: number) => string }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <label className="text-sm theme-text">{label}</label>
      <div className="flex items-center gap-2">
        <input type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} step={step} className="w-32 accent-current theme-accent" />
        <span className="text-xs theme-muted w-10 text-right">{format ? format(value) : value}</span>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets: string[] }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <label className="text-sm theme-text">{label}</label>
      <div className="flex items-center gap-1.5">
        {presets.map((p) => (
          <button key={p} onClick={() => onChange(p)} className={`w-6 h-6 rounded-full border-2 transition ${value === p ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: p }} />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
      </div>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="theme-card rounded-lg overflow-hidden">
      {title && <div className="px-4 py-2 text-xs uppercase tracking-wide theme-muted border-b theme-border-soft">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

function CardRow({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-4 border-b last:border-0 theme-border-soft">
      <div className="min-w-0">
        <div className="text-sm theme-text">{title}</div>
        {subtitle && <div className="text-xs theme-muted truncate mt-0.5">{subtitle}</div>}
      </div>
      <div className="shrink-0">{actions}</div>
    </div>
  );
}

function SmallBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${danger ? 'text-red-400 hover:bg-red-500/15' : 'theme-text hover:theme-hover'}`}>
      {children}
    </button>
  );
}

// ----- Profile section: pick a usage profile, or stay on "Personnalisé" -----

const PROFILE_META: Record<ProfileId, { icon: React.ReactNode; title: string; tagline: string; accent: string }> = {
  decouverte: { icon: <Sprout size={20} />, title: 'Découverte', tagline: 'Pour démarrer en douceur', accent: '#16a34a' },
  equilibre:  { icon: <Zap size={20} />,    title: 'Équilibré',  tagline: 'L\'usage quotidien (recommandé)', accent: '#F37223' },
  complete:   { icon: <Rocket size={20} />, title: 'Complète',   tagline: 'Toutes les fonctions', accent: '#0d9488' },
};

function ProfileSection() {
  const [, force] = useState(0);
  const current = detectCurrentProfile();
  const isCustom = current === 'custom';

  function pick(id: ProfileId) {
    if (current === id) return;
    if (!confirm(`Appliquer le profil « ${PROFILE_META[id].title} » ? Tes notes et tes paramètres personnels (thème, langue, taille de police) sont préservés. Tu peux toujours réactiver des fonctions individuelles ensuite.`)) return;
    applyProfile(id);
    force((n) => n + 1);
  }

  return (
    <div>
      <h3 className="text-lg font-semibold theme-text mb-1 flex items-center gap-2">
        <Wand2 size={16} /> Profil d'utilisation
      </h3>
      <p className="text-sm theme-muted mb-5">
        Trois préréglages pour adapter DéliNote à ton niveau d'usage. Tu peux toujours activer/désactiver des fonctions à la pièce dans les autres sections — dans ce cas, ton profil bascule automatiquement sur « Personnalisé ».
      </p>

      {isCustom && (
        <div className="mb-4 px-3 py-2 rounded-lg border theme-border-soft text-xs theme-muted flex items-center gap-2" style={{ background: 'var(--accent-bg-soft)' }}>
          <Sparkles size={13} className="theme-accent shrink-0" />
          <span>
            Tu utilises un profil <span className="font-semibold theme-accent">Personnalisé</span> — tes réglages ne correspondent à aucun preset. Tu peux ré-appliquer un profil ci-dessous (cela écrasera tes flags personnalisés mais préservera thème, langue et tes notes).
          </span>
        </div>
      )}

      <div className="space-y-3">
        {(['decouverte', 'equilibre', 'complete'] as ProfileId[]).map((id) => {
          const meta = PROFILE_META[id];
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 transition flex items-center gap-3 ${active ? 'shadow-md' : 'hover:shadow'}`}
              style={{
                borderColor: active ? meta.accent : 'var(--border)',
                background: active ? `${meta.accent}14` : 'var(--card)',
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${meta.accent}1f`, color: meta.accent }}
              >
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold theme-text">{meta.title}</span>
                  {active && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                      style={{ background: meta.accent }}
                    >
                      Actif
                    </span>
                  )}
                </div>
                <div className="text-xs theme-muted mt-0.5">{meta.tagline}</div>
              </div>
              {active && <Check size={18} style={{ color: meta.accent }} />}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] theme-muted mt-4 leading-relaxed">
        💡 <strong>Note :</strong> les profils ne touchent que les fonctions visibles. Tes notes, carnets, étiquettes, contacts, médicaments et tout le contenu sont préservés — ils sont juste cachés tant qu'ils ne sont pas réactivés.
      </p>
    </div>
  );
}

// ----- Updates section: live status + manual "check now" -----

function UpdatesSection() {
  const status = useUpdateStatus();
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try { await window.nv.updaterCheck(); } catch { /* ignore */ }
    setTimeout(() => setChecking(false), 1500);
  }

  function install() {
    void window.nv.updaterInstall();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold theme-text mb-1 flex items-center gap-2">
        <Download size={16} /> Mises à jour
      </h3>
      <p className="text-sm theme-muted mb-5">
        DéliNote vérifie automatiquement les mises à jour au démarrage. Quand une nouvelle version est disponible, elle est téléchargée silencieusement en arrière-plan, puis tu peux l'installer en un clic — sans réinstaller manuellement.
      </p>

      {/* Current version + status card */}
      <div className="rounded-xl border theme-border-soft p-4 mb-4" style={{ background: 'var(--card)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider theme-muted">Version installée</div>
            <div className="text-base font-semibold theme-text">{status.currentVersion}</div>
          </div>
          <button
            onClick={check}
            disabled={checking || status.phase === 'checking' || status.phase === 'downloading'}
            className="text-xs px-3 py-1.5 rounded-md theme-text border theme-border-soft hover:theme-hover disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={checking || status.phase === 'checking' ? 'animate-spin' : ''} />
            Vérifier maintenant
          </button>
        </div>

        <StatusLine status={status} onInstall={install} />
      </div>

      <p className="text-[11px] theme-muted leading-relaxed">
        💡 La vérification est silencieuse — pas de pop-up tant qu'aucune mise à jour n'est disponible. Quand une nouvelle version est prête, un bandeau apparaît en haut de l'app avec un bouton « Installer maintenant ». Tes notes sont préservées à chaque mise à jour.
      </p>
    </div>
  );
}

function StatusLine({ status, onInstall }: { status: ReturnType<typeof useUpdateStatus>; onInstall: () => void }) {
  switch (status.phase) {
    case 'idle':
      return (
        <div className="text-xs theme-muted flex items-center gap-2">
          <Sparkles size={12} /> Pas encore vérifié — clique sur « Vérifier maintenant »
        </div>
      );
    case 'checking':
      return (
        <div className="text-xs theme-muted flex items-center gap-2">
          <RefreshCw size={12} className="animate-spin" /> Vérification en cours…
        </div>
      );
    case 'not-available':
      return (
        <div className="text-xs flex items-center gap-2" style={{ color: '#16a34a' }}>
          <CheckCircle2 size={12} /> Tu utilises la dernière version disponible.
        </div>
      );
    case 'available':
      return (
        <div className="text-xs theme-text flex items-center gap-2">
          <Download size={12} className="theme-accent" />
          Mise à jour <span className="font-semibold">{status.nextVersion}</span> trouvée — téléchargement en cours…
        </div>
      );
    case 'downloading':
      return (
        <div>
          <div className="text-xs theme-text flex items-center gap-2 mb-1.5">
            <RefreshCw size={12} className="animate-spin theme-accent" />
            Téléchargement de <span className="font-semibold">{status.nextVersion}</span> — {status.percent}%
          </div>
          <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div className="h-full transition-all" style={{ background: 'var(--accent)', width: `${status.percent}%` }} />
          </div>
        </div>
      );
    case 'ready':
      return (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs theme-text flex items-center gap-2">
            <CheckCircle2 size={13} className="theme-accent" />
            Mise à jour <span className="font-semibold">{status.nextVersion}</span> téléchargée et prête.
          </div>
          <button
            onClick={onInstall}
            className="text-xs px-3 py-1.5 rounded-md text-white font-semibold hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Installer maintenant
          </button>
        </div>
      );
    case 'error':
      return (
        <div className="text-xs flex items-start gap-2" style={{ color: '#dc2626' }}>
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>Erreur : {status.message}</span>
        </div>
      );
  }
}

export function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`theme-card rounded-xl shadow-2xl border theme-border w-full overflow-hidden ${wide ? 'max-w-3xl' : 'max-w-xl'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b theme-border-soft">
          <h2 className="font-semibold theme-text text-sm">{title}</h2>
          <button onClick={onClose} className="theme-muted hover:theme-text">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
