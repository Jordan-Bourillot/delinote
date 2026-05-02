import { useStore } from '../store';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { Modal } from './SettingsPanel';

const SHORTCUTS: { groupKey: StringKey; items: { keys: string[]; labelKey: StringKey }[] }[] = [
  {
    groupKey: 'sh.general',
    items: [
      { keys: ['Ctrl', 'N'], labelKey: 'sh.newNote' },
      { keys: ['Ctrl', 'S'], labelKey: 'sh.save' },
      { keys: ['Ctrl', 'K'], labelKey: 'sh.quick' },
      { keys: ['Ctrl', 'F'], labelKey: 'sh.find' },
      { keys: ['Ctrl', ','], labelKey: 'sh.settings' },
      { keys: ['Ctrl', '\\'], labelKey: 'sh.toggleSidebar' },
      { keys: ['Ctrl', 'Shift', 'D'], labelKey: 'sh.distraction' },
      { keys: ['Ctrl', 'Shift', 'R'], labelKey: 'sh.read' },
      { keys: ['Ctrl', '/'], labelKey: 'sh.inspector' },
      { keys: ['?'], labelKey: 'sh.help' },
    ],
  },
  {
    groupKey: 'sh.editor',
    items: [
      { keys: ['Ctrl', 'B'], labelKey: 'sh.bold' },
      { keys: ['Ctrl', 'I'], labelKey: 'sh.italic' },
      { keys: ['Ctrl', 'U'], labelKey: 'sh.underline' },
      { keys: ['Ctrl', 'Shift', '7'], labelKey: 'sh.ol' },
      { keys: ['Ctrl', 'Shift', '8'], labelKey: 'sh.ul' },
      { keys: ['Ctrl', 'Shift', '9'], labelKey: 'sh.tl' },
      { keys: ['Ctrl', 'Shift', '1'], labelKey: 'sh.h1' },
      { keys: ['Ctrl', 'Shift', '2'], labelKey: 'sh.h2' },
      { keys: ['Ctrl', 'Shift', '3'], labelKey: 'sh.h3' },
    ],
  },
  {
    groupKey: 'sh.markdown',
    items: [
      { keys: ['#', 'space'], labelKey: 'sh.mdh1' },
      { keys: ['##', 'space'], labelKey: 'sh.mdh2' },
      { keys: ['*', 'space'], labelKey: 'sh.mdul' },
      { keys: ['1.', 'space'], labelKey: 'sh.mdol' },
      { keys: ['>', 'space'], labelKey: 'sh.mdq' },
      { keys: ['```'], labelKey: 'sh.mdcb' },
      { keys: ['---'], labelKey: 'sh.mdhr' },
    ],
  },
];

export default function ShortcutsOverlay() {
  const closeModal = useStore((s) => s.closeModal);
  const t = useT();
  return (
    <Modal onClose={closeModal} title={t('sh.title')} wide>
      <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-6 max-h-[70vh] overflow-y-auto">
        {SHORTCUTS.map((g) => (
          <div key={g.groupKey}>
            <h3 className="text-xs uppercase tracking-wider theme-muted font-semibold mb-3">{t(g.groupKey)}</h3>
            <div className="space-y-1.5">
              {g.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="theme-text">{t(it.labelKey)}</span>
                  <span className="flex gap-1">
                    {it.keys.map((k, j) => (
                      <kbd key={j} className="theme-kbd">{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
