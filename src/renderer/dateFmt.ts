import { format, formatDistanceToNow } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import { useSettings } from './settings';

/**
 * Locale-aware date formatting. Pass a date-fns format string for English; we
 * pick a French equivalent automatically when the FR locale is active.
 */
export function useDateFmt() {
  const lang = useSettings((s) => s.settings.language);
  const locale = lang === 'fr' ? frLocale : undefined;
  return {
    short: (d: Date | number) => format(d, lang === 'fr' ? 'd MMM' : 'MMM d', { locale }),
    shortTime: (d: Date | number) => format(d, lang === 'fr' ? 'd MMM HH:mm' : 'MMM d, HH:mm', { locale }),
    full: (d: Date | number) => format(d, lang === 'fr' ? "d MMMM yyyy 'à' HH:mm" : 'MMM d, yyyy · HH:mm', { locale }),
    time: (d: Date | number) => format(d, 'HH:mm'),
    iso: (d: Date | number) => format(d, lang === 'fr' ? 'dd/MM/yyyy' : 'yyyy-MM-dd'),
    relative: (d: Date | number) => formatDistanceToNow(d, { addSuffix: true, locale }),
  };
}

// Non-hook variant for use outside React (e.g. seed templates, data layer).
export function dateFmt() {
  const lang = useSettings.getState().settings.language;
  const locale = lang === 'fr' ? frLocale : undefined;
  return {
    short: (d: Date | number) => format(d, lang === 'fr' ? 'd MMM' : 'MMM d', { locale }),
    shortTime: (d: Date | number) => format(d, lang === 'fr' ? 'd MMM HH:mm' : 'MMM d, HH:mm', { locale }),
    full: (d: Date | number) => format(d, lang === 'fr' ? "d MMMM yyyy 'à' HH:mm" : 'MMM d, yyyy · HH:mm', { locale }),
    iso: (d: Date | number) => format(d, lang === 'fr' ? 'dd/MM/yyyy' : 'yyyy-MM-dd'),
  };
}
