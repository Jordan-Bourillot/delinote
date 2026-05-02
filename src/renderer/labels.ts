import { useT } from './i18n';
import { useSettings } from './settings';

/**
 * Translate seed/legacy English labels that may be persisted on disk
 * (e.g. "Untitled" notes, "Inbox" notebook from an older install)
 * so the UI is fully French (or whatever locale is active).
 */
export function useLabels() {
  const t = useT();
  return {
    noteTitle: (raw: string) => {
      const v = raw?.trim();
      if (!v || v === 'Untitled' || v === 'Sans titre') return t('list.untitled');
      return raw;
    },
    notebookName: (raw: string) => {
      const v = raw?.trim();
      if (v === 'Inbox') return t('seed.notebook.inbox');
      return raw;
    },
    templateName: (raw: string) => {
      const v = raw?.trim();
      switch (v) {
        case 'Meeting notes': return t('seed.tpl.meeting');
        case 'Daily journal': return t('seed.tpl.daily');
        case 'Blank note': return t('seed.tpl.blank');
        default: return raw;
      }
    },
  };
}
