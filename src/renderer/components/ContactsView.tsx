import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Plus, Edit2, Trash2, X, MessageCircle, Send, Phone, Mail, MapPin, Building, Search,
  Cake, CalendarHeart, Bell, Check, Square, CheckSquare,
} from 'lucide-react';
import { useT } from '../i18n';
import { useStore } from '../store';
import type { Contact, ContactEvent } from '../types';

const COLORS = ['#0d9488', '#F37223', '#3b82f6', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#ef4444'];

export default function ContactsView() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function reload() {
    const list = await window.nv.listContacts();
    setContacts(list);
  }
  useEffect(() => { void reload(); }, []);

  const filteredIdsRef = useRef<string[]>([]);

  // Ctrl+A to select all visible contacts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const target = e.target as HTMLElement | null;
        const inEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (inEditable) return;
        e.preventDefault();
        setSelected(new Set(filteredIdsRef.current));
      } else if (e.key === 'Escape' && selected.size > 0) {
        setSelected(new Set());
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected.size]);

  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q ? contacts : contacts.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.organization} ${c.phone} ${c.email}`.toLowerCase().includes(q),
    );
    const sorted = list.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    filteredIdsRef.current = sorted.map((c) => c.id);
    return sorted;
  }, [contacts, query]);

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Supprimer ${ids.length} contact${ids.length > 1 ? 's' : ''} ?`)) return;
    await window.nv.deleteContacts(ids);
    setSelected(new Set());
    await reload();
    toast('success', `${ids.length} supprimé${ids.length > 1 ? 's' : ''}`);
  }

  return (
    <div className="flex-1 overflow-y-auto theme-bg">
      <div className="max-w-4xl mx-auto px-8 pt-8 pb-12">
        <header className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}
          >
            <Users size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold theme-text">{t('contacts.title')}</h1>
            <p className="text-xs theme-muted">{contacts.length} contact{contacts.length > 1 ? 's' : ''}</p>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 theme-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sidebar.search')}
              className="theme-input rounded pl-7 pr-3 py-1.5 text-sm w-48"
            />
          </div>
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus size={14} /> {t('contacts.add')}
          </button>
        </header>

        {selected.size > 0 && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg theme-accent-bg-soft border border-current/20">
            <CheckSquare size={14} className="theme-accent" />
            <span className="text-sm theme-text">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
            <button onClick={() => setSelected(new Set(filteredIdsRef.current))} className="text-xs theme-muted hover:theme-text px-2 py-0.5 rounded hover:theme-hover">
              Tout sélectionner ({filtered.length})
            </button>
            <div className="flex-1" />
            <button onClick={bulkDelete} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 flex items-center gap-1">
              <Trash2 size={12} /> Supprimer
            </button>
            <button onClick={() => setSelected(new Set())} className="theme-muted hover:theme-text"><X size={14} /></button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="theme-card-soft rounded-xl px-6 py-10 text-center border theme-border-soft border-dashed">
            <Users size={28} className="mx-auto theme-muted mb-3 opacity-50" />
            <p className="text-sm theme-text">{t('contacts.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                checked={selected.has(c.id)}
                onToggle={() => toggleOne(c.id)}
                anySelected={selected.size > 0}
                onEdit={() => setEditing(c)}
                onDelete={async () => {
                  if (confirm(t('contacts.confirmDelete', { name: contactName(c) }))) {
                    await window.nv.deleteContact(c.id);
                    await reload();
                  }
                }}
                t={t}
                toast={toast}
              />
            ))}
          </div>
        )}

        <p className="mt-4 text-[10px] theme-muted text-center">
          Astuce : <kbd className="theme-kbd">Ctrl+A</kbd> pour tout sélectionner · <kbd className="theme-kbd">Échap</kbd> pour désélectionner
        </p>

        {(editing || adding) && (
          <ContactEditor
            initial={editing}
            onCancel={() => { setEditing(null); setAdding(false); }}
            onSave={async (data) => {
              await window.nv.saveContact(data);
              setEditing(null);
              setAdding(false);
              await reload();
              toast('success', t('contacts.saved'));
            }}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function ContactCard({ contact, onEdit, onDelete, checked, onToggle, anySelected, t, toast }: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
  checked: boolean;
  onToggle: () => void;
  anySelected: boolean;
  t: (k: any, p?: any) => string;
  toast: (kind: 'success' | 'info' | 'error', msg: string) => void;
}) {
  const cleanPhone = contact.phone.replace(/[^\d+]/g, '').replace(/^00/, '+');

  function whatsAppOpen() {
    if (!cleanPhone) { toast('error', t('contacts.noPhone')); return; }
    void window.nv.openExternal(`https://wa.me/${encodeURIComponent(cleanPhone.replace(/^\+/, ''))}`);
  }
  function whatsAppShare() {
    const text = formatContactForShare(contact);
    void window.nv.openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }
  function dial() {
    if (!cleanPhone) return;
    void window.nv.openExternal(`tel:${cleanPhone}`);
  }
  function emailTo() {
    if (!contact.email) return;
    void window.nv.openExternal(`mailto:${contact.email}`);
  }

  const upcomingEvent = nextUpcomingEvent(contact);

  return (
    <div
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || anySelected) { e.preventDefault(); onToggle(); }
      }}
      className={`theme-card rounded-xl border overflow-hidden group transition cursor-default ${
        checked ? 'border-current ring-2 ring-current/30 theme-accent-bg-soft' : 'theme-border-soft'
      }`}
    >
      <div className="p-4 flex items-start gap-3 relative">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`absolute top-2 left-2 transition ${checked || anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          title="Sélectionner"
        >
          {checked ? <CheckSquare size={14} className="theme-accent" /> : <Square size={14} className="theme-muted" />}
        </button>
        <div className={anySelected ? 'pl-5' : ''}>
          <Avatar contact={contact} size={48} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold theme-text truncate">{contactName(contact)}</h3>
          {contact.organization && (
            <div className="text-xs theme-muted truncate flex items-center gap-1">
              <Building size={10} /> {contact.organization}
            </div>
          )}
          <div className="flex flex-col gap-0.5 mt-2">
            {contact.phone && (
              <button onClick={dial} className="text-xs theme-muted hover:theme-text flex items-center gap-1.5 text-left">
                <Phone size={10} /> {contact.phone}
              </button>
            )}
            {contact.email && (
              <button onClick={emailTo} className="text-xs theme-muted hover:theme-text flex items-center gap-1.5 text-left truncate">
                <Mail size={10} /> {contact.email}
              </button>
            )}
            {contact.address && (
              <div className="text-xs theme-muted flex items-start gap-1.5">
                <MapPin size={10} className="shrink-0 mt-0.5" /> <span className="truncate">{contact.address}</span>
              </div>
            )}
            {upcomingEvent && (
              <div
                className="text-[10px] mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium self-start"
                style={{ background: 'rgba(236,72,153,0.12)', color: '#be185d' }}
              >
                {upcomingEvent.event.kind === 'birthday' ? <Cake size={10} /> : <CalendarHeart size={10} />}
                <span>{upcomingEvent.event.label || labelOfEventKind(upcomingEvent.event.kind)}</span>
                <span className="opacity-70">· {formatRelativeDate(upcomingEvent.daysUntil)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition">
          <button onClick={onEdit} className="theme-muted hover:theme-text p-1 rounded" title={t('contacts.edit')}>
            <Edit2 size={12} />
          </button>
          <button onClick={onDelete} className="theme-muted hover:text-red-500 p-1 rounded" title={t('contacts.delete')}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="border-t theme-border-soft px-3 py-2 flex gap-1.5 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
        <button
          onClick={whatsAppOpen}
          disabled={!cleanPhone}
          title={t('contacts.waOpen')}
          className="flex-1 text-xs px-2 py-1.5 rounded-lg text-white shadow-sm disabled:opacity-40 flex items-center justify-center gap-1.5 hover:opacity-90 transition"
          style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}
        >
          <MessageCircle size={12} /> {t('contacts.waOpen')}
        </button>
        <button
          onClick={whatsAppShare}
          title={t('contacts.waShare')}
          className="flex-1 text-xs px-2 py-1.5 rounded-lg theme-card border theme-border-soft hover:theme-hover theme-text flex items-center justify-center gap-1.5 transition"
        >
          <Send size={12} /> {t('contacts.waShare')}
        </button>
      </div>
    </div>
  );
}

function Avatar({ contact, size }: { contact: Contact; size: number }) {
  if (contact.avatarDataUrl) {
    return (
      <img src={contact.avatarDataUrl} width={size} height={size} alt="" className="rounded-full object-cover shrink-0" />
    );
  }
  const initials = ((contact.firstName?.[0] ?? '') + (contact.lastName?.[0] ?? '')).toUpperCase() || '?';
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: contact.color, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function ContactEditor({ initial, onSave, onCancel, t }: {
  initial: Contact | null;
  onSave: (c: Partial<Contact> & { firstName: string }) => Promise<void>;
  onCancel: () => void;
  t: (k: any, p?: any) => string;
}) {
  const [draft, setDraft] = useState<Partial<Contact>>({
    id: initial?.id,
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    organization: initial?.organization ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    notes: initial?.notes ?? '',
    color: initial?.color ?? COLORS[0],
    avatarDataUrl: initial?.avatarDataUrl ?? '',
    events: initial?.events ?? [],
  });

  function addEvent(kind: ContactEvent['kind']) {
    const ev: ContactEvent = {
      id: Math.random().toString(36).slice(2),
      kind,
      label: kind === 'birthday' ? 'Anniversaire' : kind === 'anniversary' ? 'Anniversaire de mariage' : '',
      date: new Date().toISOString().slice(0, 10),
      yearly: kind !== 'custom',
      remindBeforeDays: [7, 0],
    };
    setDraft({ ...draft, events: [...(draft.events ?? []), ev] });
  }
  function updateEvent(id: string, patch: Partial<ContactEvent>) {
    setDraft({
      ...draft,
      events: (draft.events ?? []).map((e) => e.id === id ? { ...e, ...patch } : e),
    });
  }
  function removeEvent(id: string) {
    setDraft({ ...draft, events: (draft.events ?? []).filter((e) => e.id !== id) });
  }
  function toggleReminder(id: string, days: number) {
    const ev = (draft.events ?? []).find((e) => e.id === id);
    if (!ev) return;
    const set = new Set(ev.remindBeforeDays);
    set.has(days) ? set.delete(days) : set.add(days);
    updateEvent(id, { remindBeforeDays: Array.from(set).sort((a, b) => b - a) });
  }

  async function pickAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      // Resize to 256px max for storage efficiency
      const url = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(f);
      });
      const img = new Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = img.width * scale, h = img.height * scale;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setDraft((d) => ({ ...d, avatarDataUrl: c.toDataURL('image/jpeg', 0.85) }));
      };
      img.src = url;
    };
    input.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40 backdrop-blur-sm pop-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="theme-card border theme-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b theme-border-soft">
          <h2 className="font-semibold theme-text text-sm">{initial ? t('contacts.edit') : t('contacts.add')}</h2>
          <button onClick={onCancel} className="theme-muted hover:theme-text"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-4">
            <Avatar contact={draft as Contact} size={64} />
            <div className="flex flex-col gap-1.5">
              <button onClick={pickAvatar} className="text-xs px-3 py-1.5 rounded-lg theme-card border theme-border-soft hover:theme-hover">
                {t('contacts.pickAvatar')}
              </button>
              {draft.avatarDataUrl && (
                <button onClick={() => setDraft({ ...draft, avatarDataUrl: '' })} className="text-xs theme-muted hover:text-red-500">
                  Retirer
                </button>
              )}
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={`w-4 h-4 rounded-full transition ${draft.color === c ? 'ring-2 ring-offset-1 ring-current scale-110' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('contacts.firstName')}>
              <input autoFocus value={draft.firstName ?? ''} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} className="w-full theme-input rounded px-3 py-2 outline-none" />
            </Field>
            <Field label={t('contacts.lastName')}>
              <input value={draft.lastName ?? ''} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} className="w-full theme-input rounded px-3 py-2 outline-none" />
            </Field>
          </div>
          <Field label={t('contacts.organization')}>
            <input value={draft.organization ?? ''} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} className="w-full theme-input rounded px-3 py-2 outline-none" />
          </Field>
          <Field label={t('contacts.phone')}>
            <input
              value={draft.phone ?? ''}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="+33 6 12 34 56 78"
              className="w-full theme-input rounded px-3 py-2 outline-none font-mono"
            />
            <p className="text-[10px] theme-muted mt-1">{t('contacts.phoneHint')}</p>
          </Field>
          <Field label={t('contacts.email')}>
            <input type="email" value={draft.email ?? ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full theme-input rounded px-3 py-2 outline-none" />
          </Field>
          <Field label={t('contacts.address')}>
            <input value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className="w-full theme-input rounded px-3 py-2 outline-none" />
          </Field>

          {/* Events: birthday / anniversary / custom — each with reminders */}
          <Field label="Dates importantes">
            <div className="space-y-2">
              {(draft.events ?? []).map((ev) => (
                <div key={ev.id} className="theme-card-soft border theme-border-soft rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {ev.kind === 'birthday' ? <Cake size={14} className="text-pink-500" /> :
                      ev.kind === 'anniversary' ? <CalendarHeart size={14} className="text-pink-500" /> :
                      <Bell size={14} className="theme-muted" />}
                    <input
                      value={ev.label}
                      onChange={(e) => updateEvent(ev.id, { label: e.target.value })}
                      placeholder={ev.kind === 'birthday' ? 'Anniversaire' : ev.kind === 'anniversary' ? 'Anniversaire de mariage' : 'Nom de l\'évènement'}
                      className="flex-1 bg-transparent outline-none theme-text text-sm font-medium"
                    />
                    <button onClick={() => removeEvent(ev.id)} className="theme-muted hover:text-red-500"><X size={12} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={ev.date}
                      onChange={(e) => updateEvent(ev.id, { date: e.target.value })}
                      className="theme-input rounded px-2 py-1 text-sm outline-none"
                    />
                    <label className="flex items-center gap-1.5 text-xs theme-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ev.yearly}
                        onChange={(e) => updateEvent(ev.id, { yearly: e.target.checked })}
                        className="accent-current theme-accent"
                      />
                      Tous les ans
                    </label>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider theme-muted font-semibold mb-1">Me prévenir</div>
                    <div className="flex flex-wrap gap-1">
                      {[30, 14, 7, 3, 1, 0].map((d) => {
                        const active = ev.remindBeforeDays.includes(d);
                        return (
                          <button
                            key={d}
                            onClick={() => toggleReminder(ev.id, d)}
                            className={`text-[11px] px-2 py-1 rounded transition ${
                              active ? 'theme-accent-bg text-white shadow-sm' : 'theme-card border theme-border-soft hover:theme-hover theme-muted'
                            }`}
                          >
                            {d === 0 ? 'Le jour J' : `${d} j avant`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => addEvent('birthday')} className="text-xs px-3 py-1.5 rounded-lg theme-card border theme-border-soft hover:theme-hover flex items-center gap-1.5">
                  <Cake size={12} /> Anniversaire
                </button>
                <button onClick={() => addEvent('anniversary')} className="text-xs px-3 py-1.5 rounded-lg theme-card border theme-border-soft hover:theme-hover flex items-center gap-1.5">
                  <CalendarHeart size={12} /> Mariage / Pacs
                </button>
                <button onClick={() => addEvent('custom')} className="text-xs px-3 py-1.5 rounded-lg theme-card border theme-border-soft hover:theme-hover flex items-center gap-1.5">
                  <Bell size={12} /> Évènement
                </button>
              </div>
            </div>
          </Field>

          <Field label={t('contacts.notes')}>
            <textarea value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} className="w-full theme-input rounded px-3 py-2 outline-none" />
          </Field>
        </div>
        <div className="px-4 py-3 border-t theme-border-soft flex justify-end gap-2 theme-bg-soft">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded theme-muted hover:theme-text hover:theme-hover">
            {t('settings.cancel')}
          </button>
          <button
            onClick={() => draft.firstName?.trim() && onSave({ ...draft, firstName: draft.firstName.trim() } as any)}
            disabled={!draft.firstName?.trim()}
            className="text-sm px-4 py-1.5 rounded text-white theme-accent-bg hover:opacity-90 disabled:opacity-40 shadow-sm"
          >
            {t('med.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider theme-muted font-semibold block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function contactName(c: Contact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.organization || c.phone || 'Sans nom';
}

function formatContactForShare(c: Contact): string {
  const lines: string[] = [];
  lines.push(`📇 ${contactName(c)}`);
  if (c.organization) lines.push(c.organization);
  if (c.phone) lines.push(`📱 ${c.phone}`);
  if (c.email) lines.push(`✉️ ${c.email}`);
  if (c.address) lines.push(`📍 ${c.address}`);
  if (c.notes) lines.push('', c.notes);
  return lines.join('\n');
}

/** Find the next upcoming event (yearly recurring honored). Returns null if none. */
function nextUpcomingEvent(c: Contact): { event: ContactEvent; daysUntil: number } | null {
  if (!c.events?.length) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let best: { event: ContactEvent; daysUntil: number } | null = null;
  for (const ev of c.events) {
    if (!ev.date) continue;
    const [y, m, d] = ev.date.split('-').map(Number);
    if (!y || !m || !d) continue;
    let next = new Date(y, m - 1, d);
    if (ev.yearly) {
      next = new Date(today.getFullYear(), m - 1, d);
      if (next.getTime() < today.getTime()) next.setFullYear(today.getFullYear() + 1);
    }
    const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0) continue;
    if (!best || daysUntil < best.daysUntil) best = { event: ev, daysUntil };
  }
  return best;
}

function formatRelativeDate(daysUntil: number): string {
  if (daysUntil === 0) return "aujourd'hui";
  if (daysUntil === 1) return 'demain';
  if (daysUntil < 7) return `dans ${daysUntil} j`;
  if (daysUntil < 30) return `dans ${Math.round(daysUntil / 7)} sem`;
  return `dans ${Math.round(daysUntil / 30)} mois`;
}

function labelOfEventKind(k: ContactEvent['kind']): string {
  return k === 'birthday' ? 'Anniversaire' : k === 'anniversary' ? 'Anniversaire' : 'Évènement';
}
