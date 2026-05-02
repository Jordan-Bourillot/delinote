import { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { encryptString, decryptString, isEnvelope } from '../crypto';

/** In-memory cache of unlocked notes. Cleared when the app closes. */
const sessionPasswords = new Map<string, string>();

export function isNoteEncrypted(content: string): boolean {
  return isEnvelope(content);
}

export function getCachedPassword(noteId: string): string | undefined {
  return sessionPasswords.get(noteId);
}

export function cachePassword(noteId: string, pwd: string) {
  sessionPasswords.set(noteId, pwd);
}

export function clearCachedPassword(noteId: string) {
  sessionPasswords.delete(noteId);
}

/** Modal shown over the editor when the current note is encrypted and not yet unlocked. */
export function UnlockGate({ noteId, encryptedContent, onUnlocked }: {
  noteId: string;
  encryptedContent: string;
  onUnlocked: (decryptedContent: string, decryptedText: string, password: string) => void;
}) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function tryUnlock() {
    if (!pwd) return;
    setBusy(true);
    try {
      const plain = await decryptString(encryptedContent, pwd);
      // Convention: we encrypt JSON `{ content, text }` together
      const parsed = JSON.parse(plain);
      cachePassword(noteId, pwd);
      onUnlocked(parsed.content ?? '', parsed.text ?? '', pwd);
      toast('success', t('enc.unlockedToast'));
    } catch {
      toast('error', t('enc.wrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center theme-bg p-8">
      <div className="theme-card border theme-border rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full theme-accent-bg-soft flex items-center justify-center mb-4">
          <Lock size={28} className="theme-accent" />
        </div>
        <h2 className="font-bold theme-text text-lg">{t('enc.locked')}</h2>
        <p className="text-sm theme-muted mt-1">{t('enc.passwordPrompt')}</p>
        <div className="mt-5 relative">
          <input
            type={show ? 'text' : 'password'}
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void tryUnlock(); }}
            placeholder={t('enc.password')}
            className="w-full theme-input rounded-lg px-3 py-2.5 outline-none"
          />
          <button
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 theme-muted hover:theme-text"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={tryUnlock}
          disabled={busy || !pwd}
          className="mt-4 w-full px-4 py-2.5 rounded-lg text-white theme-accent-bg hover:opacity-90 disabled:opacity-40 font-medium shadow-sm"
        >
          {t('enc.unlock')}
        </button>
      </div>
    </div>
  );
}

/** Modal shown when locking a plaintext note (asks for password twice). */
export function LockDialog({ noteId, currentContent, currentText, onLocked, onCancel }: {
  noteId: string;
  currentContent: string;
  currentText: string;
  onLocked: (encryptedContent: string, password: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);

  async function lock() {
    if (!p1) return;
    if (p1 !== p2) { toast('error', t('enc.mismatch')); return; }
    setBusy(true);
    try {
      const plain = JSON.stringify({ content: currentContent, text: currentText });
      const env = await encryptString(plain, p1);
      cachePassword(noteId, p1);
      onLocked(env, p1);
      toast('success', t('enc.lockedToast'));
    } catch (e: any) {
      toast('error', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="theme-card border theme-border rounded-xl shadow-2xl p-6 max-w-sm w-full" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg theme-accent-bg-soft flex items-center justify-center">
            <Lock size={18} className="theme-accent" />
          </div>
          <div>
            <h2 className="font-bold theme-text">{t('enc.lock')}</h2>
            <p className="text-xs theme-muted">{t('enc.lockPrompt')}</p>
          </div>
        </div>
        <input
          type="password"
          autoFocus
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          placeholder={t('enc.password')}
          className="w-full theme-input rounded px-3 py-2 outline-none mb-2"
        />
        <input
          type="password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void lock(); }}
          placeholder={t('enc.passwordConfirm')}
          className="w-full theme-input rounded px-3 py-2 outline-none"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded theme-muted hover:theme-text hover:theme-hover">
            {t('med.cancel')}
          </button>
          <button onClick={lock} disabled={busy || !p1} className="text-sm px-4 py-1.5 rounded text-white theme-accent-bg hover:opacity-90 disabled:opacity-40 shadow-sm">
            {t('enc.lock')}
          </button>
        </div>
      </div>
    </div>
  );
}
