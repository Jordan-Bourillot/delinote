import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { useSettings } from './settings';
import { useT } from './i18n';
import Sidebar from './components/Sidebar';
import NoteList from './components/NoteList';
import Editor from './components/Editor';
import MedScreen from './components/MedScreen';
import Calendar from './components/Calendar';
import TasksView from './components/TasksView';
import FilesView from './components/FilesView';
import ContactsView from './components/ContactsView';
import HelpView from './components/HelpView';
import Tabs from './components/Tabs';
import Onboarding, { shouldShowOnboarding } from './components/Onboarding';
import AppTour, { shouldShowTour } from './components/AppTour';
import ProfileChooser from './components/ProfileChooser';
import { shouldShowProfileChooser } from './profiles';
import BetaBanner from './components/BetaBanner';
import UpdateBanner from './components/UpdateBanner';
import FeedbackDialog from './components/FeedbackDialog';
import UpdatingDialog from './components/UpdatingDialog';
import MurmurePanel from './components/MurmurePanel';
import FluxMode from './components/FluxMode';
import EnergyView from './components/EnergyView';
import MoodBoard from './components/MoodBoard';
import QrShare from './components/QrShare';
import MedicationStartupReminder, { alreadyDismissedToday } from './components/MedicationStartupReminder';
import WhatsNewModal, { shouldShowWhatsNew } from './components/WhatsNew';
import BetaExpired from './components/BetaExpired';
import { checkBetaStatus } from './betaGuard';
import StatusBar from './components/StatusBar';
import RightPanel from './components/RightPanel';
import SettingsPanel from './components/SettingsPanel';
import QuickSwitcher from './components/QuickSwitcher';
import FindReplace from './components/FindReplace';
import ShortcutsOverlay from './components/ShortcutsOverlay';
import TemplatesPanel from './components/TemplatesPanel';
import { Logo } from './components/Logo';

export default function App() {
  // Beta lifecycle check — block the whole UI if the beta has expired.
  // Computed once per mount; the timestamp is persisted on first call.
  const betaStatus = useMemo(() => checkBetaStatus(), []);

  const { refresh, loading, newNote, flushSave, openModal, closeModal, modal, toggleSidebar, toasts, dismissToast, collapsedSidebar, current } = useStore();
  const settings = useSettings((s) => s.settings);
  const toggle = useSettings((s) => s.toggle);
  const t = useT();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Apply theme + accent to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.style.setProperty('--accent', settings.accentColor);
  }, [settings.theme, settings.accentColor]);

  // Start/stop the local clipper HTTP server based on user preference.
  useEffect(() => {
    if (settings.enableWebClipperServer) void window.nv.startClipperServer?.();
    else void window.nv.stopClipperServer?.();
  }, [settings.enableWebClipperServer]);

  // Subscribe to system events (clipper page received, reminder fired) and
  // push them into the in-app notification center.
  useEffect(() => {
    const offClip = window.nv.onClipperReceived?.((info) => {
      useStore.getState().pushNotification({
        kind: 'clip',
        title: t('clipper.received', { title: info.title }),
        link: { kind: 'note', id: info.id },
      });
      useStore.getState().toast('success', t('clipper.received', { title: info.title }));
      void useStore.getState().refresh();
    });
    const offRem = window.nv.onReminderFired?.((r: any) => {
      useStore.getState().pushNotification({
        kind: 'reminder',
        title: t('rem.fired'),
        body: r.title,
        link: r.noteId ? { kind: 'note', id: r.noteId } : undefined,
      });
    });
    return () => { offClip?.(); offRem?.(); };
  }, [t]);

  // Schedule today's medication reminders and re-schedule at midnight.
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    let midnight: ReturnType<typeof setTimeout> | null = null;

    async function scheduleToday() {
      timers.forEach(clearTimeout); timers = [];
      const [meds, intakes, calEvents, contacts] = await Promise.all([
        window.nv.listMedications(),
        window.nv.listIntakes(),
        window.nv.listCalendarEvents(),
        window.nv.listContacts(),
      ]);
      const now = new Date();
      const dow = now.getDay();

      // Medication intakes (today)
      for (const m of meds) {
        if (!m.active) continue;
        if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dow)) continue;
        for (const time of m.schedule) {
          const [h, mi] = time.split(':').map(Number);
          const d = new Date(now);
          d.setHours(h, mi, 0, 0);
          const at = d.getTime();
          if (at <= Date.now()) continue;
          const already = intakes.find((x) => x.medId === m.id && x.scheduledFor === at && (x.takenAt || x.skipped));
          if (already) continue;
          const delay = at - Date.now();
          const tm = setTimeout(() => {
            const body = m.dosage ? `${m.name} — ${m.dosage}` : m.name;
            void window.nv.medNotify('💊 ' + (settings.language === 'fr' ? "C'est l'heure" : 'Time'), body);
          }, Math.min(delay, 0x7fffffff));
          timers.push(tm);
        }
      }

      // Calendar events: fire reminders that fall within the next 24h
      for (const e of calEvents) {
        const [y, mo, da] = e.date.split('-').map(Number);
        if (!y) continue;
        const eventStart = new Date(y, mo - 1, da);
        if (e.time) {
          const [h, mi] = e.time.split(':').map(Number);
          eventStart.setHours(h, mi, 0, 0);
        } else {
          eventStart.setHours(9, 0, 0, 0);
        }
        for (const daysBefore of e.remindBeforeDays ?? []) {
          const fireAt = eventStart.getTime() - daysBefore * 86_400_000;
          if (fireAt <= Date.now()) continue;
          const delay = fireAt - Date.now();
          if (delay > 86_400_000) continue; // only schedule next 24h here
          const tm = setTimeout(() => {
            const when = daysBefore === 0
              ? (e.time ? `aujourd'hui à ${e.time}` : "aujourd'hui")
              : daysBefore === 1 ? 'demain'
              : `dans ${daysBefore} jours`;
            void window.nv.medNotify('📅 ' + e.title, `${when}${e.notes ? ' — ' + e.notes.slice(0, 80) : ''}`);
          }, Math.min(delay, 0x7fffffff));
          timers.push(tm);
        }
      }

      // Contact events: yearly recurring birthdays/anniversaries — find the next occurrence
      const tomorrowEnd = Date.now() + 86_400_000;
      for (const c of contacts) {
        for (const ev of c.events ?? []) {
          if (!ev.date) continue;
          const [, evMo, evDa] = ev.date.split('-').map(Number);
          if (!evMo || !evDa) continue;
          // Build the next occurrence (yearly or one-shot)
          let occ = new Date(now.getFullYear(), evMo - 1, evDa, 9, 0, 0);
          if (!ev.yearly) {
            const [y0] = ev.date.split('-').map(Number);
            occ = new Date(y0, evMo - 1, evDa, 9, 0, 0);
          } else if (occ.getTime() < Date.now()) {
            occ.setFullYear(now.getFullYear() + 1);
          }
          for (const daysBefore of ev.remindBeforeDays ?? []) {
            const fireAt = occ.getTime() - daysBefore * 86_400_000;
            if (fireAt <= Date.now() || fireAt > tomorrowEnd) continue;
            const label = ev.label || (ev.kind === 'birthday' ? 'Anniversaire' : 'Évènement');
            const tm = setTimeout(() => {
              const when = daysBefore === 0 ? "aujourd'hui" : daysBefore === 1 ? 'demain' : `dans ${daysBefore} j`;
              void window.nv.medNotify(`🎂 ${label} — ${c.firstName} ${c.lastName}`.trim(), when);
            }, Math.min(fireAt - Date.now(), 0x7fffffff));
            timers.push(tm);
          }
        }
      }

      const tomorrow = new Date(); tomorrow.setHours(24, 0, 5, 0);
      midnight = setTimeout(scheduleToday, tomorrow.getTime() - Date.now());
    }
    void scheduleToday();
    return () => { timers.forEach(clearTimeout); if (midnight) clearTimeout(midnight); };
  }, [settings.language]);

  // Detect optional user-supplied background image at src/renderer/public/fond.{png,jpg,jpeg,webp}
  useEffect(() => {
    const candidates = ['./fond.png', './fond.jpg', './fond.jpeg', './fond.webp'];
    const root = document.documentElement;
    let cancelled = false;
    (async () => {
      for (const url of candidates) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
        if (cancelled) return;
        if (ok) {
          root.style.setProperty('--fond-url', `url(${url})`);
          root.classList.add('has-fond');
          return;
        }
      }
      root.classList.remove('has-fond');
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const inEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); void newNote(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void flushSave({ snapshot: true }); useStore.getState().toast('success', t('toast.saved')); }
      else if (mod && e.key.toLowerCase() === 'k' && settings.enableQuickSwitcher) { e.preventDefault(); openModal('quick-switcher'); }
      else if (mod && e.key.toLowerCase() === 'f' && settings.enableFindReplace && current) { e.preventDefault(); openModal('find'); }
      else if (mod && e.key === ',') { e.preventDefault(); openModal('settings'); }
      else if (mod && e.key === '\\') { e.preventDefault(); toggleSidebar(); }
      else if (mod && e.key === '/') { e.preventDefault(); toggle('showRightPanel'); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        // If a note is open → ask "how many copies?" via the editor.
        // Otherwise → toggle distraction-free.
        if (useStore.getState().current && !useStore.getState().current!.trashed) {
          window.dispatchEvent(new CustomEvent('delinote:open-duplicate'));
        } else {
          toggle('distractionFree');
        }
      }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'r' && settings.enableReadMode) { e.preventDefault(); useStore.getState().toast('info', t('toast.readToggleHint')); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        void useStore.getState().openDailyNote();
      }
      else if (e.key === 'Escape') { closeModal(); }
      else if (e.key === '?' && !inEditable && settings.enableShortcutsOverlay) { e.preventDefault(); openModal('shortcuts'); }
      // Tab navigation: Alt+1..9 to switch to nth tab, Ctrl+W to close current
      else if (e.altKey && /^[1-9]$/.test(e.key) && !inEditable) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        const tab = useStore.getState().openTabs[idx];
        if (tab) void useStore.getState().selectNote(tab);
      }
      else if (mod && e.key.toLowerCase() === 'w' && useStore.getState().selectedId) {
        e.preventDefault();
        const sid = useStore.getState().selectedId!;
        const tabs = useStore.getState().openTabs;
        const idx = tabs.indexOf(sid);
        useStore.getState().closeTab(sid);
        const next = tabs[idx + 1] ?? tabs[idx - 1];
        if (next) void useStore.getState().selectNote(next);
        else useStore.setState({ selectedId: null, current: null });
      }
      // j/k arrow nav across the note list when not in an input
      else if (!inEditable && (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const isDown = e.key === 'j' || e.key === 'ArrowDown';
        const all = document.querySelectorAll('[data-note-row]');
        if (all.length === 0) return;
        const arr = Array.from(all) as HTMLElement[];
        const sid = useStore.getState().selectedId;
        const cur = sid ? arr.findIndex((el) => el.dataset.noteRow === sid) : -1;
        const next = isDown ? Math.min(arr.length - 1, cur + 1) : Math.max(0, cur - 1);
        const target = arr[next];
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ block: 'nearest' });
          const id = target.dataset.noteRow!;
          void useStore.getState().selectNote(id);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newNote, flushSave, openModal, closeModal, toggleSidebar, toggle, current, settings.enableQuickSwitcher, settings.enableFindReplace, settings.enableReadMode, settings.enableShortcutsOverlay]);

  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY — keep them above the loading early-return.
  const view = useStore((s) => s.view);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showProfileChooser, setShowProfileChooser] = useState(false);
  const [showMedReminder, setShowMedReminder] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showUpdating, setShowUpdating] = useState(false);
  const [showFlux, setShowFlux] = useState(false);
  const [showEnergy, setShowEnergy] = useState(false);
  // Mood-board: null = closed, '' = global board, 'noteId' = per-note board.
  const [moodBoardNoteId, setMoodBoardNoteId] = useState<string | null>(null);
  const [showQrShare, setShowQrShare] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Lab : open the various modes when the sidebar buttons fire.
  useEffect(() => {
    const onFlux = () => setShowFlux(true);
    const onEnergy = () => setShowEnergy(true);
    const onMood = () => setMoodBoardNoteId('');
    const onMoodNote = (e: Event) => {
      const id = (e as CustomEvent<{ noteId: string }>).detail?.noteId;
      if (id) setMoodBoardNoteId(id);
    };
    const onQr = () => setShowQrShare(true);
    window.addEventListener('delinote:open-flux', onFlux);
    window.addEventListener('delinote:open-energy', onEnergy);
    window.addEventListener('delinote:open-moodboard', onMood);
    window.addEventListener('delinote:open-moodboard-for-note', onMoodNote);
    window.addEventListener('delinote:open-qrshare', onQr);
    return () => {
      window.removeEventListener('delinote:open-flux', onFlux);
      window.removeEventListener('delinote:open-energy', onEnergy);
      window.removeEventListener('delinote:open-moodboard', onMood);
      window.removeEventListener('delinote:open-moodboard-for-note', onMoodNote);
      window.removeEventListener('delinote:open-qrshare', onQr);
    };
  }, []);

  // Show "What's new" popup once after each version upgrade.
  useEffect(() => {
    if (loading || showOnboarding) return;
    if (!shouldShowWhatsNew()) return;
    const tm = setTimeout(() => setShowWhatsNew(true), 600);
    return () => clearTimeout(tm);
  }, [loading, showOnboarding]);

  // Beta : le main process demande à afficher le FeedbackDialog au moment du close
  useEffect(() => {
    const off = (window as any).nv?.onShowFeedbackDialog?.(() => setShowFeedback(true));
    return () => { try { off?.(); } catch { /* ignore */ } };
  }, []);

  // Auto-update : le main demande à afficher le dialogue « mise à jour en
  // cours » à la place du FeedbackDialog quand la fermeture vient de
  // « Installer maintenant ».
  useEffect(() => {
    const off = (window as any).nv?.onShowUpdatingDialog?.(() => setShowUpdating(true));
    return () => { try { off?.(); } catch { /* ignore */ } };
  }, []);

  function confirmAppClose() {
    setShowFeedback(false);
    setShowUpdating(false);
    try { void (window as any).nv?.confirmAppClose?.(); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (loading) return;
    // Onboarding flow priority:
    //   1) Onboarding (welcome)            ⇢ first-ever launch
    //   2) ProfileChooser                  ⇢ pick simple/balanced/full
    //   3) AppTour                         ⇢ guided tour of the UI
    if (shouldShowOnboarding()) {
      setShowOnboarding(true);
    } else if (shouldShowProfileChooser()) {
      const tm = setTimeout(() => setShowProfileChooser(true), 400);
      return () => clearTimeout(tm);
    } else if (shouldShowTour()) {
      // Onboarding & profile already done but tour not seen yet (upgrade case)
      const tm = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(tm);
    }
  }, [loading]);

  function handleOnboardingClose() {
    setShowOnboarding(false);
    // After onboarding: profile chooser → tour
    if (shouldShowProfileChooser()) {
      setTimeout(() => setShowProfileChooser(true), 350);
    } else if (shouldShowTour()) {
      setTimeout(() => setShowTour(true), 400);
    }
  }

  function handleProfileChosen() {
    setShowProfileChooser(false);
    if (shouldShowTour()) {
      setTimeout(() => setShowTour(true), 350);
    }
  }

  // Once-per-day startup reminder for today's medications.
  useEffect(() => {
    if (loading || showOnboarding) return;
    if (alreadyDismissedToday()) return;
    // Wait a beat so the app finishes mounting before the modal pops in.
    const tm = setTimeout(async () => {
      try {
        const meds = await window.nv.listMedications();
        if (meds.length === 0) return;
        const intakes = await window.nv.listIntakes();
        const now = new Date();
        const dow = now.getDay();
        let hasPending = false;
        for (const m of meds) {
          if (!m.active) continue;
          if (m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dow)) continue;
          for (const time of m.schedule) {
            const [h, mi] = time.split(':').map(Number);
            const d = new Date(now); d.setHours(h, mi, 0, 0);
            const at = d.getTime();
            const intake = intakes.find((x) => x.medId === m.id && x.scheduledFor === at);
            if (!intake?.takenAt && !intake?.skipped) { hasPending = true; break; }
          }
          if (hasPending) break;
        }
        if (hasPending) setShowMedReminder(true);
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(tm);
  }, [loading, showOnboarding]);

  // If the current view is for a module that's been disabled (via profile or
  // Settings), bounce the user back to "all notes" so they don't end up
  // staring at a blinking cursor with no escape.
  // ⚠️ MUST be called unconditionally — DO NOT move below the early-returns.
  useEffect(() => {
    const map: Partial<Record<typeof view.kind, boolean>> = {
      calendar: settings.enableCalendarModule,
      tasks: settings.enableTasksModule,
      files: settings.enableFilesModule,
      contacts: settings.enableContactsModule,
      meds: settings.enableMedicationsModule,
      help: settings.enableHelpModule,
    };
    if (view.kind in map && map[view.kind] === false) {
      useStore.getState().setView({ kind: 'all' });
    }
  }, [view.kind, settings.enableCalendarModule, settings.enableTasksModule, settings.enableFilesModule, settings.enableContactsModule, settings.enableMedicationsModule, settings.enableHelpModule]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center theme-bg gap-5 fade-in">
        <div className="relative">
          <Logo size={88} className="drop-shadow-md" />
          <span
            aria-hidden
            className="absolute -inset-3 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, var(--accent-bg-soft) 0%, transparent 70%)',
              animation: 'edit-mode-pulse 2s ease-out infinite',
            }}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold theme-text tracking-tight">DéliNote</h1>
          <p className="text-xs theme-muted">Démarrage…</p>
        </div>
        <div
          className="w-32 h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--border)' }}
        >
          <div
            className="h-full"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
              animation: 'slide-in-from-right 1.4s ease-in-out infinite',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>
    );
  }

  // Beta has expired → block the entire app behind a full-screen explainer.
  if (betaStatus.expired) {
    return <BetaExpired status={betaStatus} />;
  }

  const distractionFree = settings.distractionFree;
  const showSidebar = !distractionFree && settings.showSidebar && !collapsedSidebar;
  const isSpecialView = view.kind === 'meds' || view.kind === 'calendar' || view.kind === 'tasks' || view.kind === 'files' || view.kind === 'contacts' || view.kind === 'help';
  const showList = !distractionFree && settings.showNoteList && !isSpecialView;
  const showRight = !distractionFree && settings.showRightPanel && !isSpecialView;

  function renderMain() {
    let content: React.ReactNode;
    switch (view.kind) {
      case 'meds': content = <MedScreen />; break;
      case 'calendar': content = <Calendar />; break;
      case 'tasks': content = <TasksView />; break;
      case 'files': content = <FilesView />; break;
      case 'contacts': content = <ContactsView />; break;
      case 'help': content = <HelpView />; break;
      default: content = (
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs />
          <div className="flex-1 flex min-h-0">
            <Editor />
          </div>
        </div>
      );
    }
    return <div key={view.kind} className="flex-1 flex flex-col min-w-0 fade-in">{content}</div>;
  }

  return (
    <div className="h-full flex flex-col theme-bg relative">
      {settings.backgroundImage && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-center bg-cover bg-no-repeat"
          style={{
            backgroundImage: `url(${settings.backgroundImage})`,
            opacity: Math.max(0, Math.min(1, settings.backgroundOpacity / 100)),
            zIndex: 0,
          }}
        />
      )}
      <div className="relative z-[1] flex flex-col h-full">
      <UpdateBanner />
      <BetaBanner />
      <div className="flex-1 flex min-h-0">
        {showSidebar && <Sidebar />}
        {showList && <NoteList />}
        {renderMain()}
        {showRight && <RightPanel />}
      </div>
      {settings.showStatusBar && <StatusBar />}

      {modal === 'settings' && <SettingsPanel />}
      {modal === 'quick-switcher' && settings.enableQuickSwitcher && <QuickSwitcher />}
      {modal === 'find' && settings.enableFindReplace && <FindReplace />}
      {modal === 'shortcuts' && settings.enableShortcutsOverlay && <ShortcutsOverlay />}
      {modal === 'templates' && settings.enableTemplates && <TemplatesPanel />}

      <Toasts toasts={toasts} dismiss={dismissToast} />
      {showOnboarding && <Onboarding onClose={handleOnboardingClose} />}
      {showProfileChooser && !showOnboarding && (
        <ProfileChooser onClose={handleProfileChosen} />
      )}
      {showTour && !showOnboarding && !showProfileChooser && <AppTour onClose={() => setShowTour(false)} />}
      {showFeedback && <FeedbackDialog onConfirmClose={confirmAppClose} />}
      {showUpdating && <UpdatingDialog onConfirmClose={confirmAppClose} />}
      {showWhatsNew && !showOnboarding && !showTour && (
        <WhatsNewModal onClose={() => setShowWhatsNew(false)} />
      )}
      {showMedReminder && !showOnboarding && !showTour && !showWhatsNew && (
        <MedicationStartupReminder onClose={() => setShowMedReminder(false)} />
      )}
      {settings.labMurmure && <MurmurePanel />}
      {showFlux && <FluxMode onClose={() => setShowFlux(false)} />}
      {showEnergy && <EnergyView onClose={() => setShowEnergy(false)} />}
      {moodBoardNoteId !== null && (
        <MoodBoard
          noteId={moodBoardNoteId === '' ? null : moodBoardNoteId}
          onClose={() => setMoodBoardNoteId(null)}
        />
      )}
      {showQrShare && <QrShare onClose={() => setShowQrShare(false)} />}
      </div>
    </div>
  );
}

function Toasts({ toasts, dismiss }: { toasts: { id: string; kind: 'info' | 'success' | 'error'; message: string; action?: { label: string; run: () => void } }[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-8 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto pl-3 pr-2 py-2 rounded-lg shadow-xl text-sm flex items-center gap-3 animate-in slide-in-from-right ${
            t.kind === 'success' ? 'bg-emerald-600 text-white' :
            t.kind === 'error' ? 'bg-red-600 text-white' :
            'theme-card border theme-border theme-text'
          }`}
        >
          <span onClick={() => dismiss(t.id)} className="cursor-pointer flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action!.run(); dismiss(t.id); }}
              className="text-xs font-semibold px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 px-1">×</button>
        </div>
      ))}
    </div>
  );
}
