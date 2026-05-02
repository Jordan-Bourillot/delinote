import { useEffect } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import { useLabels } from '../labels';
import { Modal } from './SettingsPanel';
import { Sparkles, Trash2 } from 'lucide-react';

export default function TemplatesPanel() {
  const { templates, loadTemplates, newFromTemplate, deleteTemplate, closeModal } = useStore();
  const t = useT();
  const lbl = useLabels();

  useEffect(() => { void loadTemplates(); }, []);

  return (
    <Modal onClose={closeModal} title={t('tpl.title')} wide>
      <div className="p-5">
        <p className="text-sm theme-muted mb-4">{t('tpl.intro')}</p>
        <div className="grid grid-cols-2 gap-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="theme-card-soft rounded-lg p-3 hover:theme-hover transition flex items-start gap-3">
              <div className="theme-accent shrink-0 mt-0.5">
                <Sparkles size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <button onClick={() => { void newFromTemplate(tpl.id); closeModal(); }} className="text-left w-full">
                  <div className="font-medium theme-text">{lbl.templateName(tpl.name)}</div>
                  <div className="text-xs theme-muted truncate mt-0.5">{tpl.title}</div>
                </button>
              </div>
              <button
                onClick={() => { if (confirm(t('tpl.confirmDelete', { name: tpl.name }))) void deleteTemplate(tpl.id); }}
                className="theme-muted hover:text-red-400 p-1"
                title={t('tpl.delete')}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={async () => {
            const name = window.prompt(t('tpl.namePrompt'));
            if (!name) return;
            const title = window.prompt(t('tpl.titlePrompt'), t('tpl.untitled')) ?? t('tpl.untitled');
            await useStore.getState().saveTemplate({
              name,
              title,
              content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
            });
            useStore.getState().toast('success', t('tpl.saved'));
          }}
          className="mt-4 text-xs px-3 py-1.5 rounded text-white theme-accent-bg hover:opacity-90"
        >
          {t('tpl.save')}
        </button>
      </div>
    </Modal>
  );
}
