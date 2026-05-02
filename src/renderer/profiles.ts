// User profile presets — three "experience modes" that batch-toggle settings
// to make DéliNote less overwhelming for newcomers while keeping the full
// feature set one click away.
//
// Profiles never touch personal/cosmetic settings (theme, accentColor,
// firstName, fontFamily, fontSize, language) — only the feature flags.

import type { Settings } from './settings';
import { useSettings, DEFAULT_SETTINGS } from './settings';

export type ProfileId = 'decouverte' | 'equilibre' | 'complete';

const PROFILE_KEY = 'delinote.profile.id';
const CHOSEN_KEY = 'delinote.profile.chosen';

/**
 * Settings keys that profiles do NOT touch — preserved across profile changes
 * so that picking a new profile doesn't reset the user's theme or language.
 */
const PRESERVED_KEYS: (keyof Settings)[] = [
  'language',
  'firstName',
  'theme',
  'lastDarkLightChoice',
  'accentColor',
  'fontFamily',
  'fontSize',
  'editorWidth',
  'autoSaveDebounceMs',
  'historyMaxSnapshots',
  'recentCount',
  'showInTaskbar',
];

// ----- The three profiles. Each one is a FULL feature flag overlay applied on
// top of DEFAULT_SETTINGS. They list every flag explicitly for readability so
// you can grep what's on/off in each mode.

/** Découverte — ultra-épuré : juste les notes, pas de bruit. */
const DECOUVERTE: Partial<Settings> = {
  // Layout
  showSidebar: true,
  showNoteList: true,
  showRightPanel: false,
  showStatusBar: false,
  showToolbar: true,
  distractionFree: false,
  // Sidebar sections
  showAllNotes: true,
  showRecentSection: true,
  showTagsSection: true,
  showTrashSection: true,
  showStacks: false,
  // List
  pinnedAtTop: true,
  showExcerpts: true,
  showDates: true,
  showTagPills: true,
  showColorLabels: false,
  // Editor — basics only
  enableMarkdownShortcuts: true,
  enableSpellcheck: true,
  enableHeadings: true,
  enableLists: true,
  enableTaskLists: false,
  enableBlockquote: true,
  enableCodeBlock: false,
  enableSyntaxHighlight: false,
  enableUnderline: true,
  enableHighlight: false,
  enableTextColor: false,
  enableTextAlign: false,
  enableTypography: true,
  enableTables: false,
  enableImages: true,
  enableLinks: true,
  enableHorizontalRule: false,
  enableWikiLinks: false,
  // Note features
  enableTags: true,
  enablePinning: true,
  enableColorLabels: false,
  enableBacklinks: false,
  enableTableOfContents: false,
  enableNoteHistory: false,
  enableTemplates: false,
  enableWordCount: true,
  enableReadingTime: false,
  // App
  autoSave: true,
  enableSearch: true,
  enableQuickSwitcher: false,
  enableFindReplace: true,
  enableExport: true,
  enableImport: false,
  enableReadMode: false,
  enableShortcutsOverlay: false,
  enableNotebookStacks: false,
  enableAutoBackup: false,
  enableWebClipperServer: false,
  autoBackupOnExit: false,
  confirmDeleteForever: true,
  // Modules — all OFF except Help (so the user can still find their way around)
  enableCalendarModule: false,
  enableTasksModule: false,
  enableFilesModule: false,
  enableContactsModule: false,
  enableMedicationsModule: false,
  enableHelpModule: true,
};

/** Équilibré — usage classique, modules de productivité activés sauf santé/contacts. */
const EQUILIBRE: Partial<Settings> = {
  // Layout
  showSidebar: true,
  showNoteList: true,
  showRightPanel: false,
  showStatusBar: true,
  showToolbar: true,
  distractionFree: false,
  // Sidebar sections
  showAllNotes: true,
  showRecentSection: true,
  showTagsSection: true,
  showTrashSection: true,
  showStacks: true,
  // List
  pinnedAtTop: true,
  showExcerpts: true,
  showDates: true,
  showTagPills: true,
  showColorLabels: true,
  // Editor — most things on, no math/mermaid (those land via Complète)
  enableMarkdownShortcuts: true,
  enableSpellcheck: true,
  enableHeadings: true,
  enableLists: true,
  enableTaskLists: true,
  enableBlockquote: true,
  enableCodeBlock: true,
  enableSyntaxHighlight: true,
  enableUnderline: true,
  enableHighlight: true,
  enableTextColor: true,
  enableTextAlign: true,
  enableTypography: true,
  enableTables: true,
  enableImages: true,
  enableLinks: true,
  enableHorizontalRule: true,
  enableWikiLinks: true,
  // Note features
  enableTags: true,
  enablePinning: true,
  enableColorLabels: true,
  enableBacklinks: false,
  enableTableOfContents: false,
  enableNoteHistory: true,
  enableTemplates: true,
  enableWordCount: true,
  enableReadingTime: true,
  // App
  autoSave: true,
  enableSearch: true,
  enableQuickSwitcher: true,
  enableFindReplace: true,
  enableExport: true,
  enableImport: true,
  enableReadMode: true,
  enableShortcutsOverlay: true,
  enableNotebookStacks: true,
  enableAutoBackup: false,
  enableWebClipperServer: false,
  autoBackupOnExit: false,
  confirmDeleteForever: true,
  // Modules — productivity on, health/contacts off
  enableCalendarModule: true,
  enableTasksModule: true,
  enableFilesModule: true,
  enableContactsModule: false,
  enableMedicationsModule: false,
  enableHelpModule: true,
};

/** Complète — tout activé, comme avant. Sert de référence pour la détection 'custom'. */
function buildComplete(): Partial<Settings> {
  // Take everything from defaults except the preserved cosmetic keys.
  const all: Partial<Settings> = {};
  (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).forEach((k) => {
    if (PRESERVED_KEYS.includes(k)) return;
    (all as any)[k] = DEFAULT_SETTINGS[k];
  });
  return all;
}

const PROFILE_OVERLAYS: Record<ProfileId, Partial<Settings>> = {
  decouverte: DECOUVERTE,
  equilibre: EQUILIBRE,
  complete: buildComplete(),
};

export const ALL_PROFILES: ProfileId[] = ['decouverte', 'equilibre', 'complete'];

/** Apply a profile preset to the current settings, preserving cosmetic keys. */
export function applyProfile(id: ProfileId): void {
  const overlay = PROFILE_OVERLAYS[id];
  const current = useSettings.getState().settings;
  // Build the next settings: start with current (preserves cosmetic keys),
  // then overlay the profile's feature flags on top.
  const next: Settings = { ...current, ...overlay };
  // Persist & update the store via the existing import path so save() runs.
  useSettings.getState().importFromJSON(JSON.stringify(next));
  try { localStorage.setItem(PROFILE_KEY, id); } catch { /* ignore */ }
  markProfileChosen();
}

/** Returns the user's current profile, or 'custom' if their settings don't match any preset. */
export function detectCurrentProfile(s: Settings = useSettings.getState().settings): ProfileId | 'custom' {
  for (const id of ALL_PROFILES) {
    if (matchesProfile(s, PROFILE_OVERLAYS[id])) return id;
  }
  return 'custom';
}

function matchesProfile(s: Settings, overlay: Partial<Settings>): boolean {
  for (const k of Object.keys(overlay) as (keyof Settings)[]) {
    if (s[k] !== overlay[k]) return false;
  }
  return true;
}

/** Read the profile id last set explicitly by the user (if any). */
export function storedProfileId(): ProfileId | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw === 'decouverte' || raw === 'equilibre' || raw === 'complete') return raw;
    return null;
  } catch { return null; }
}

export function markProfileChosen(): void {
  try { localStorage.setItem(CHOSEN_KEY, '1'); } catch { /* ignore */ }
}

/**
 * Should we show the first-launch profile chooser?
 *
 * Yes if: the user has never picked a profile AND they look brand new
 * (the AppTour hasn't been done yet — this means it's a fresh install,
 * not an upgrade from a pre-profiles version).
 *
 * For upgraders: we silently mark them as 'custom' (their existing settings
 * are theirs to keep) so they're never bothered by the chooser.
 */
export function shouldShowProfileChooser(): boolean {
  try {
    const chosen = localStorage.getItem(CHOSEN_KEY) === '1';
    if (chosen) return false;
    const tourDone = localStorage.getItem('delinote.uitour.done') === '1';
    if (tourDone) {
      // Existing user — silently mark as chosen so they never see the modal.
      markProfileChosen();
      return false;
    }
    return true;
  } catch { return false; }
}

/** Reset for testing — open DevTools and run window.__resetProfile() */
if (typeof window !== 'undefined') {
  (window as any).__resetProfile = () => {
    try {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(CHOSEN_KEY);
      localStorage.removeItem('delinote.uitour.done');
      location.reload();
    } catch { /* ignore */ }
  };
}
