import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useDateFmt } from '../dateFmt';
import { Bell, X, Check, Trash2, FileText, Pill, AlertCircle, Globe } from 'lucide-react';
import type { AppNotification } from '../types';

export function NotificationBell() {
  const notifications = useStore((s) => s.notifications);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="theme-muted hover:theme-text p-1 rounded relative"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
            style={{ background: 'var(--accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { notifications, markAllRead, clearNotifications, selectNote } = useStore();
  const t = useT();
  const df = useDateFmt();

  return (
    <div className="absolute top-full right-0 mt-2 w-80 max-h-96 theme-popover rounded-lg shadow-2xl border theme-border overflow-hidden z-50 flex flex-col">
      <div className="px-3 py-2 border-b theme-border-soft flex items-center justify-between">
        <h3 className="text-sm font-semibold theme-text flex items-center gap-2">
          <Bell size={13} />
          {t('notif.title')}
        </h3>
        <div className="flex gap-1">
          <button onClick={markAllRead} title={t('notif.markRead')} className="theme-muted hover:theme-text p-1">
            <Check size={12} />
          </button>
          <button onClick={clearNotifications} title={t('notif.clear')} className="theme-muted hover:theme-text p-1">
            <Trash2 size={12} />
          </button>
          <button onClick={onClose} className="theme-muted hover:theme-text p-1">
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm theme-muted">{t('notif.empty')}</div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (n.link?.kind === 'note') void selectNote(n.link.id);
                onClose();
              }}
              className={`w-full text-left px-3 py-2 border-b theme-border-soft hover:theme-hover flex items-start gap-2 transition ${
                !n.read ? 'theme-accent-bg-soft' : ''
              }`}
            >
              <span className="theme-muted shrink-0 mt-0.5">{iconFor(n.kind)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider theme-muted font-semibold">{t(`notif.kind.${n.kind}` as any)}</div>
                <div className="text-sm theme-text">{n.title}</div>
                {n.body && <div className="text-xs theme-muted mt-0.5 line-clamp-2">{n.body}</div>}
                <div className="text-[10px] theme-muted mt-1">{df.relative(n.at)}</div>
              </div>
              {!n.read && <span className="w-1.5 h-1.5 rounded-full theme-accent-bg shrink-0 mt-1.5" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function iconFor(kind: AppNotification['kind']) {
  switch (kind) {
    case 'reminder': return <AlertCircle size={14} />;
    case 'med': return <Pill size={14} />;
    case 'clip': return <Globe size={14} />;
    default: return <FileText size={14} />;
  }
}
