import { create } from 'zustand';

export type Settings = {
  // Locale
  language: 'en' | 'fr';
  // Personal
  firstName: string;
  // Theme & appearance
  theme: 'dark' | 'light' | 'sepia' | 'caribbean';
  lastDarkLightChoice: 'dark' | 'light';
  editorWidth: 'narrow' | 'wide' | 'full';
  fontFamily: 'sans' | 'serif' | 'mono';
  fontSize: number; // 14-22
  accentColor: string;
  // Image de fond personnalisée (data URL) + opacité 0-100. '' = pas d'image.
  backgroundImage: string;
  backgroundOpacity: number;

  // Layout panels
  showSidebar: boolean;
  showNoteList: boolean;
  showRightPanel: boolean;
  showStatusBar: boolean;
  showToolbar: boolean;
  distractionFree: boolean;

  // Sidebar sections
  showAllNotes: boolean;
  showRecentSection: boolean;
  recentCount: number;
  showTagsSection: boolean;
  showTrashSection: boolean;
  showStacks: boolean;

  // Note list options
  notesSortBy: 'updated' | 'created' | 'title';
  notesSortOrder: 'desc' | 'asc';
  pinnedAtTop: boolean;
  showExcerpts: boolean;
  showDates: boolean;
  showTagPills: boolean;
  showColorLabels: boolean;
  listDensity: 'comfortable' | 'compact';

  // Editor extensions (toggle features)
  enableMarkdownShortcuts: boolean;
  enableSpellcheck: boolean;
  enableUnderline: boolean;
  enableHighlight: boolean;
  enableTextColor: boolean;
  enableTextAlign: boolean;
  enableTypography: boolean;
  enableTaskLists: boolean;
  enableTables: boolean;
  enableImages: boolean;
  enableLinks: boolean;
  enableHorizontalRule: boolean;
  enableBlockquote: boolean;
  enableCodeBlock: boolean;
  enableSyntaxHighlight: boolean;
  enableHeadings: boolean;
  enableLists: boolean;
  enableWikiLinks: boolean; // [[note]] linking

  // Note features
  enablePinning: boolean;
  enableColorLabels: boolean;
  urgentBlink: boolean;
  enableTags: boolean;
  enableBacklinks: boolean;
  enableTableOfContents: boolean;
  enableNoteHistory: boolean;
  historyMaxSnapshots: number;
  enableTemplates: boolean;
  enableWordCount: boolean;
  enableReadingTime: boolean;

  // App features
  autoSave: boolean;
  autoSaveDebounceMs: number;
  enableSearch: boolean;
  enableQuickSwitcher: boolean;
  enableFindReplace: boolean;
  enableExport: boolean;
  enableImport: boolean;
  enableReadMode: boolean;
  enableShortcutsOverlay: boolean;
  enableNotebookStacks: boolean;
  enableAutoBackup: boolean;
  enableWebClipperServer: boolean; // local HTTP listener (Avast hates these)
  autoBackupOnExit: boolean;
  confirmDeleteForever: boolean;

  // Privacy
  showInTaskbar: boolean;

  // Sidebar modules (productivity entries below the notebooks list)
  enableCalendarModule: boolean;
  enableTasksModule: boolean;
  enableFilesModule: boolean;
  enableContactsModule: boolean;
  enableMedicationsModule: boolean;
  enableHelpModule: boolean;

  // ----- Lab / innovations (toggles for 8 disruptive features) -----
  // Off by default — user opts in. Each one ships with a feedback widget
  // (j'aime / à améliorer / pas d'intérêt) collected in localStorage.
  labMurmure: boolean;          // AI suggests links between notes via embeddings
  labFlux: boolean;             // Continuous-writing mode that auto-segments
  labVocalSpatial: boolean;     // Voice notes with time + context capture
  labMoodboard: boolean;        // Free-canvas note type
  labEnergyCalendar: boolean;   // Energy-based scheduling instead of clock-based
  labQrShare: boolean;          // Peer-to-peer note sharing via QR
  labTimeTravel: boolean;       // Snapshot scrubber to view a note at any past moment
  labAutoArchive: boolean;      // Hide notes untouched for N days from default views
  labAutoArchiveDays: number;   // Days threshold for auto-archive (default 60)
};

function defaultLanguage(): 'en' | 'fr' {
  // Default to French as requested.
  return 'fr';
}

export const DEFAULT_SETTINGS: Settings = {
  language: defaultLanguage(),
  firstName: '',
  theme: 'caribbean', // warm cream + teal — the brand default
  lastDarkLightChoice: 'light',
  editorWidth: 'wide',
  fontFamily: 'sans',
  fontSize: 16,
  accentColor: '#F37223', // LeDenicheur orange — pairs nicely with caribbean cream
  backgroundImage: '',
  backgroundOpacity: 30,

  showSidebar: true,
  showNoteList: true,
  showRightPanel: false,
  showStatusBar: true,
  showToolbar: true,
  distractionFree: false,

  showAllNotes: true,
  showRecentSection: true,
  recentCount: 5,
  showTagsSection: true,
  showTrashSection: true,
  showStacks: true,

  notesSortBy: 'updated',
  notesSortOrder: 'desc',
  pinnedAtTop: true,
  showExcerpts: true,
  showDates: true,
  showTagPills: true,
  showColorLabels: true,
  listDensity: 'comfortable',

  enableMarkdownShortcuts: true,
  enableSpellcheck: true,
  enableUnderline: true,
  enableHighlight: true,
  enableTextColor: true,
  enableTextAlign: true,
  enableTypography: true,
  enableTaskLists: true,
  enableTables: true,
  enableImages: true,
  enableLinks: true,
  enableHorizontalRule: true,
  enableBlockquote: true,
  enableCodeBlock: true,
  enableSyntaxHighlight: true,
  enableHeadings: true,
  enableLists: true,
  enableWikiLinks: true,

  enablePinning: true,
  enableColorLabels: true,
  urgentBlink: true,
  enableTags: true,
  enableBacklinks: true,
  enableTableOfContents: true,
  enableNoteHistory: true,
  historyMaxSnapshots: 25,
  enableTemplates: true,
  enableWordCount: true,
  enableReadingTime: true,

  autoSave: true,
  autoSaveDebounceMs: 400,
  enableSearch: true,
  enableQuickSwitcher: true,
  enableFindReplace: true,
  enableExport: true,
  enableImport: true,
  enableReadMode: true,
  enableShortcutsOverlay: true,
  enableNotebookStacks: true,
  enableAutoBackup: false,
  enableWebClipperServer: false, // OFF by default — only enable if you install the Chrome extension
  autoBackupOnExit: false,
  confirmDeleteForever: true,

  showInTaskbar: true,

  enableCalendarModule: true,
  enableTasksModule: true,
  enableFilesModule: true,
  enableContactsModule: true,
  enableMedicationsModule: true,
  enableHelpModule: true,

  labMurmure: false,
  labFlux: false,
  labVocalSpatial: false,
  labMoodboard: false,
  labEnergyCalendar: false,
  labQrShare: false,
  labTimeTravel: false,
  labAutoArchive: false,
  labAutoArchiveDays: 60,
};

const STORAGE_KEY = 'notevault.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore quota errors
  }
}

type SettingsState = {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  toggle: (key: BoolKeys) => void;
  reset: () => void;
  importFromJSON: (json: string) => boolean;
  exportToJSON: () => string;
};

type BoolKeys = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

export const useSettings = create<SettingsState>((set, get) => ({
  settings: load(),
  set: (key, value) =>
    set((s) => {
      const next = { ...s.settings, [key]: value };
      save(next);
      return { settings: next };
    }),
  toggle: (key) =>
    set((s) => {
      const next = { ...s.settings, [key]: !s.settings[key] };
      save(next);
      return { settings: next };
    }),
  reset: () => {
    save(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
  importFromJSON: (json) => {
    try {
      const parsed = JSON.parse(json);
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      save(merged);
      set({ settings: merged });
      return true;
    } catch {
      return false;
    }
  },
  exportToJSON: () => JSON.stringify(get().settings, null, 2),
}));

// ----- Feature catalogue used by the Settings panel -----

export type FeatureToggle = {
  key: BoolKeys;
  labelKey: string;
  hintKey?: string;
};

export type FeatureCategory = {
  id: string;
  labelKey: string;
  toggles: FeatureToggle[];
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'layout', labelKey: 'settings.layout',
    toggles: [
      { key: 'showSidebar', labelKey: 'feat.showSidebar', hintKey: 'feat.showSidebar.hint' },
      { key: 'showNoteList', labelKey: 'feat.showNoteList', hintKey: 'feat.showNoteList.hint' },
      { key: 'showRightPanel', labelKey: 'feat.showRightPanel', hintKey: 'feat.showRightPanel.hint' },
      { key: 'showToolbar', labelKey: 'feat.showToolbar' },
      { key: 'showStatusBar', labelKey: 'feat.showStatusBar', hintKey: 'feat.showStatusBar.hint' },
      { key: 'distractionFree', labelKey: 'feat.distractionFree', hintKey: 'feat.distractionFree.hint' },
    ],
  },
  {
    id: 'sidebar', labelKey: 'settings.sidebarSections',
    toggles: [
      { key: 'showAllNotes', labelKey: 'feat.showAllNotes' },
      { key: 'showRecentSection', labelKey: 'feat.showRecentSection' },
      { key: 'showTagsSection', labelKey: 'feat.showTagsSection' },
      { key: 'showTrashSection', labelKey: 'feat.showTrashSection' },
      { key: 'showStacks', labelKey: 'feat.showStacks' },
    ],
  },
  {
    id: 'list', labelKey: 'settings.list',
    toggles: [
      { key: 'pinnedAtTop', labelKey: 'feat.pinnedAtTop' },
      { key: 'showExcerpts', labelKey: 'feat.showExcerpts' },
      { key: 'showDates', labelKey: 'feat.showDates' },
      { key: 'showTagPills', labelKey: 'feat.showTagPills' },
      { key: 'showColorLabels', labelKey: 'feat.showColorLabels' },
    ],
  },
  {
    id: 'editor', labelKey: 'settings.editor',
    toggles: [
      { key: 'enableMarkdownShortcuts', labelKey: 'feat.enableMarkdownShortcuts', hintKey: 'feat.enableMarkdownShortcuts.hint' },
      { key: 'enableSpellcheck', labelKey: 'feat.enableSpellcheck' },
      { key: 'enableHeadings', labelKey: 'feat.enableHeadings' },
      { key: 'enableLists', labelKey: 'feat.enableLists' },
      { key: 'enableTaskLists', labelKey: 'feat.enableTaskLists' },
      { key: 'enableBlockquote', labelKey: 'feat.enableBlockquote' },
      { key: 'enableCodeBlock', labelKey: 'feat.enableCodeBlock' },
      { key: 'enableSyntaxHighlight', labelKey: 'feat.enableSyntaxHighlight' },
      { key: 'enableUnderline', labelKey: 'feat.enableUnderline' },
      { key: 'enableHighlight', labelKey: 'feat.enableHighlight' },
      { key: 'enableTextColor', labelKey: 'feat.enableTextColor' },
      { key: 'enableTextAlign', labelKey: 'feat.enableTextAlign' },
      { key: 'enableTypography', labelKey: 'feat.enableTypography', hintKey: 'feat.enableTypography.hint' },
      { key: 'enableTables', labelKey: 'feat.enableTables' },
      { key: 'enableImages', labelKey: 'feat.enableImages' },
      { key: 'enableLinks', labelKey: 'feat.enableLinks' },
      { key: 'enableHorizontalRule', labelKey: 'feat.enableHorizontalRule' },
      { key: 'enableWikiLinks', labelKey: 'feat.enableWikiLinks' },
    ],
  },
  {
    id: 'note', labelKey: 'settings.note',
    toggles: [
      { key: 'enableTags', labelKey: 'feat.enableTags' },
      { key: 'enablePinning', labelKey: 'feat.enablePinning' },
      { key: 'enableColorLabels', labelKey: 'feat.enableColorLabels' },
      { key: 'urgentBlink', labelKey: 'feat.urgentBlink', hintKey: 'feat.urgentBlink.hint' },
      { key: 'enableBacklinks', labelKey: 'feat.enableBacklinks' },
      { key: 'enableTableOfContents', labelKey: 'feat.enableTableOfContents' },
      { key: 'enableNoteHistory', labelKey: 'feat.enableNoteHistory' },
      { key: 'enableTemplates', labelKey: 'feat.enableTemplates' },
      { key: 'enableWordCount', labelKey: 'feat.enableWordCount' },
      { key: 'enableReadingTime', labelKey: 'feat.enableReadingTime' },
    ],
  },
  {
    id: 'modules', labelKey: 'settings.modules',
    toggles: [
      { key: 'enableCalendarModule', labelKey: 'feat.enableCalendarModule', hintKey: 'feat.enableCalendarModule.hint' },
      { key: 'enableTasksModule', labelKey: 'feat.enableTasksModule' },
      { key: 'enableFilesModule', labelKey: 'feat.enableFilesModule' },
      { key: 'enableContactsModule', labelKey: 'feat.enableContactsModule' },
      { key: 'enableMedicationsModule', labelKey: 'feat.enableMedicationsModule' },
      { key: 'enableHelpModule', labelKey: 'feat.enableHelpModule' },
    ],
  },
  {
    id: 'app', labelKey: 'settings.app',
    toggles: [
      { key: 'autoSave', labelKey: 'feat.autoSave' },
      { key: 'enableSearch', labelKey: 'feat.enableSearch' },
      { key: 'enableQuickSwitcher', labelKey: 'feat.enableQuickSwitcher' },
      { key: 'enableFindReplace', labelKey: 'feat.enableFindReplace' },
      { key: 'enableExport', labelKey: 'feat.enableExport' },
      { key: 'enableImport', labelKey: 'feat.enableImport' },
      { key: 'enableReadMode', labelKey: 'feat.enableReadMode' },
      { key: 'enableShortcutsOverlay', labelKey: 'feat.enableShortcutsOverlay' },
      { key: 'enableNotebookStacks', labelKey: 'feat.enableNotebookStacks' },
      { key: 'enableAutoBackup', labelKey: 'feat.enableAutoBackup' },
      { key: 'enableWebClipperServer', labelKey: 'feat.enableWebClipperServer', hintKey: 'feat.enableWebClipperServer.hint' },
      { key: 'autoBackupOnExit', labelKey: 'feat.autoBackupOnExit' },
      { key: 'confirmDeleteForever', labelKey: 'feat.confirmDeleteForever' },
    ],
  },
];
