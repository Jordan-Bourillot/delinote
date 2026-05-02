import { useState } from 'react';
import {
  HelpCircle, FileText, Calendar, CheckSquare, Paperclip, Pill, Users, Search, Sparkles,
  Settings as SettingsIcon, Lock, Mic, Eye, Tag, Pin, Palette, Download, Upload, Keyboard, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useT } from '../i18n';
import { Logo } from './Logo';
import { TriskellMark, openTriskellSite, TRISKELL_URL } from './TriskellMark';

type Section = {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
};

export default function HelpView() {
  const t = useT();
  const [open, setOpen] = useState<string>('basics');

  const sections: Section[] = [
    {
      id: 'basics',
      icon: <FileText size={18} />,
      title: 'Bases : créer, éditer, organiser une note',
      body: (
        <>
          <p>Crée une note avec <KBD>Ctrl+N</KBD> ou en cliquant <strong>Nouvelle note</strong> dans l'écran d'accueil.</p>
          <p>Tape <KBD>/</KBD> dans une note pour insérer un titre, une liste, du code, une équation maths, un tableau, un diagramme Mermaid ou une image.</p>
          <p>Pour <strong>attacher un fichier</strong> : glisse-le directement dans l'éditeur. PDF, photos, audio, ZIP — tout marche, c'est stocké à côté de la note.</p>
          <p>Auto-sauvegarde après 400ms d'inactivité. <KBD>Ctrl+S</KBD> force la sauvegarde + crée un instantané (visible dans le panneau de droite "Historique").</p>
        </>
      ),
    },
    {
      id: 'org',
      icon: <Pin size={18} />,
      title: 'Organisation : carnets, étiquettes, couleurs, épingles',
      body: (
        <>
          <p><strong>Carnets</strong> : sidebar gauche, regroupe les notes par sujet. Tu peux les regrouper en <em>piles</em> (groupes de carnets).</p>
          <p><strong>Étiquettes (#tags)</strong> : ajoute des mots-clés à tes notes. Chaque étiquette a sa propre couleur, déterministe (la même étiquette aura toujours la même teinte).</p>
          <p><strong>Couleurs</strong> : 7 couleurs assignables à une note (clic droit → palette). Une bande verticale de la couleur apparaît à gauche dans la liste.</p>
          <p><strong>Épingler</strong> : 📌 dans le menu d'une note, ou clic droit → Épingler. Les notes épinglées remontent en haut.</p>
          <p><strong>Clic droit</strong> sur une note dans la liste = menu complet : ouvrir, dupliquer (×N), épingler, couleur, étiqueter, déplacer, corbeille.</p>
        </>
      ),
    },
    {
      id: 'search',
      icon: <Search size={18} />,
      title: 'Recherche & navigation rapide',
      body: (
        <>
          <p><KBD>Ctrl+K</KBD> ouvre la <strong>recherche rapide</strong> — tape les premières lettres pour retrouver instantanément n'importe quelle note, carnet, étiquette ou action de l'app. La recherche tolère les fautes de frappe.</p>
          <p><KBD>Ctrl+F</KBD> ouvre <strong>rechercher & remplacer</strong> dans la note courante.</p>
          <p>Navigation au clavier dans la liste : <KBD>j</KBD>/<KBD>k</KBD> ou <KBD>↑</KBD>/<KBD>↓</KBD>.</p>
          <p><KBD>Alt+1..9</KBD> bascule entre les onglets ouverts. <KBD>Ctrl+W</KBD> ferme l'onglet.</p>
        </>
      ),
    },
    {
      id: 'agenda',
      icon: <Calendar size={18} />,
      title: 'Agenda',
      body: (
        <>
          <p>Vue mois qui agrège <strong>notes modifiées</strong>, <strong>prises de médicaments</strong> et <strong>rappels</strong> par jour.</p>
          <p>Pastille colorée par jour : verte = tout pris, orange = partiel, rouge = manqué.</p>
          <p>Clic sur un jour → panneau latéral détaillant tout ce qui s'est passé. Bouton + crée une note datée du jour sélectionné.</p>
        </>
      ),
    },
    {
      id: 'tasks',
      icon: <CheckSquare size={18} />,
      title: 'Tâches',
      body: (
        <>
          <p>Toutes les cases à cocher de toutes tes notes agrégées dans une vue centrale. Filtres : à faire / faites / toutes.</p>
          <p>Cocher dans la vue Tâches met à jour la note d'origine. Clic sur la flèche → ouvre la note source.</p>
        </>
      ),
    },
    {
      id: 'files',
      icon: <Paperclip size={18} />,
      title: 'Fichiers',
      body: (
        <>
          <p>Liste de toutes les pièces jointes de toutes tes notes en un seul endroit. Recherche par nom de fichier, taille, type, date d'ajout.</p>
          <p>Clic sur un fichier → ouverture avec l'app système associée (Word, VLC, etc.).</p>
        </>
      ),
    },
    {
      id: 'meds',
      icon: <Pill size={18} />,
      title: 'Médicaments',
      body: (
        <>
          <p>Module dédié au suivi de tes traitements. Ajoute un médicament avec <strong>nom, dosage, horaires précis et jours</strong> (presets : Matin/Midi/Soir/Nuit, 2×/3×/4× par jour, Tous les jours / Lun-Ven / Week-end).</p>
          <p>3 onglets : <em>Aujourd'hui</em> (prises du jour avec bouton "Prendre"), <em>Mes médicaments</em> (gestion), <em>Historique</em> (heatmap d'adhérence sur 30 jours).</p>
          <p>L'app envoie une <strong>notification Windows</strong> quand c'est l'heure d'une prise. Suivi de stock + alerte de renouvellement.</p>
          <p>Messages d'<strong>encouragement adaptatifs</strong> selon ta série : « Bravo », « Tu y es presque », « Pas grave pour hier, on repart aujourd'hui ».</p>
        </>
      ),
    },
    {
      id: 'contacts',
      icon: <Users size={18} />,
      title: 'Contacts & WhatsApp',
      body: (
        <>
          <p>Crée une fiche contact : nom, organisation, téléphone, email, adresse, notes, photo.</p>
          <p>Deux boutons WhatsApp par fiche :
            <br />• <strong>Ouvrir conversation</strong> : ouvre WhatsApp Web/Desktop directement sur la conversation avec ce contact.
            <br />• <strong>Partager</strong> : ouvre WhatsApp avec la fiche pré-formatée pour la transmettre à quelqu'un d'autre.
          </p>
          <p>Astuce numéros : enregistre au format international (+33 6 12 34 56 78) pour que le lien WhatsApp marche.</p>
        </>
      ),
    },
    {
      id: 'editor',
      icon: <Sparkles size={18} />,
      title: 'Fonctions avancées de l\'éditeur',
      body: (
        <>
          <p><KBD>/</KBD> au début d'une ligne → menu d'insertion : titres, listes, tâches, code, citation, ligne, tableau, image, équation maths (LaTeX/KaTeX), diagramme Mermaid.</p>
          <p>Markdown shortcuts : <KBD>#</KBD> + espace = titre 1, <KBD>*</KBD> + espace = liste, <KBD>&gt;</KBD> + espace = citation, <KBD>```</KBD> = bloc de code.</p>
          <p>Drag-drop image dans la note → embarquée. Drag-drop autre fichier → attaché en chip.</p>
          <p>Bouton <Mic size={11} className="inline" /> dans la toolbar : enregistrement audio direct.</p>
          <p>Bouton <Eye size={11} className="inline" /> sur une image : OCR pour extraire le texte (Tesseract.js, FR+EN, télécharge ~30Mo au premier usage).</p>
        </>
      ),
    },
    {
      id: 'security',
      icon: <Lock size={18} />,
      title: 'Sécurité & vie privée',
      body: (
        <>
          <p><strong>100% local</strong>. Aucune donnée ne quitte ton ordinateur, aucun compte, aucune télémétrie. Les notes sont stockées en JSON dans <code>%APPDATA%\delinote\DeliNoteData\</code>.</p>
          <p><strong>Chiffrement par note</strong> : menu ⋯ → 🔒 Verrouiller. Chiffrement AES-256-GCM via WebCrypto, clé dérivée du mot de passe par PBKDF2 (210 000 itérations, SHA-256). Si tu perds le mot de passe, le contenu est <strong>irrécupérable</strong>.</p>
          <p>Sauvegarde : Réglages → Données → "Tout exporter" produit un .json contenant tout. Importable plus tard.</p>
        </>
      ),
    },
    {
      id: 'import',
      icon: <Upload size={18} />,
      title: 'Importer depuis d\'autres apps',
      body: (
        <>
          <p>Réglages → Données → "Importer depuis une autre application" :</p>
          <ul style={{ marginLeft: 16 }}>
            <li><strong>ENEX</strong> : fichier export Evernote.</li>
            <li><strong>Dossier</strong> : Obsidian (vault), Notion (export ZIP décompressé), Bear, Joplin, Apple Notes — tout dossier de .md/.txt. Les sous-dossiers deviennent des étiquettes.</li>
            <li><strong>PDF</strong> : sélectionne plusieurs PDFs, le texte est extrait et chacun devient une note dans un carnet "Importé — PDF".</li>
          </ul>
        </>
      ),
    },
    {
      id: 'shortcuts',
      icon: <Keyboard size={18} />,
      title: 'Raccourcis clavier',
      body: (
        <ul style={{ marginLeft: 16, lineHeight: 2 }}>
          <li><KBD>Ctrl+N</KBD> Nouvelle note</li>
          <li><KBD>Ctrl+S</KBD> Forcer sauvegarde + instantané</li>
          <li><KBD>Ctrl+K</KBD> Quick switcher / palette de commandes</li>
          <li><KBD>Ctrl+F</KBD> Rechercher & remplacer dans la note</li>
          <li><KBD>Ctrl+,</KBD> Réglages</li>
          <li><KBD>Ctrl+\</KBD> Afficher/masquer la barre latérale</li>
          <li><KBD>Ctrl+/</KBD> Afficher/masquer l'inspecteur droit</li>
          <li><KBD>Ctrl+Maj+D</KBD> Dupliquer la note (avec choix du nombre d'exemplaires)</li>
          <li><KBD>Ctrl+W</KBD> Fermer l'onglet</li>
          <li><KBD>Alt+1..9</KBD> Aller à l'onglet N</li>
          <li><KBD>?</KBD> Vue raccourcis détaillée</li>
          <li><KBD>j</KBD>/<KBD>k</KBD> ou flèches : naviguer dans la liste de notes</li>
        </ul>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto theme-bg">
      <div className="max-w-3xl mx-auto px-8 pt-8 pb-12">
        <header className="flex items-center gap-4 mb-8">
          <Logo size={56} className="drop-shadow-md" />
          <div>
            <h1 className="text-2xl font-bold theme-text">Aide DéliNote</h1>
            <p className="text-sm theme-muted mt-0.5">Guide complet de toutes les fonctionnalités</p>
          </div>
        </header>

        <div className="space-y-2">
          {sections.map((s) => {
            const isOpen = open === s.id;
            return (
              <div key={s.id} className="theme-card rounded-xl border theme-border-soft overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? '' : s.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:theme-hover transition"
                >
                  <span className="theme-accent shrink-0">{s.icon}</span>
                  <span className="font-semibold theme-text flex-1">{s.title}</span>
                  {isOpen ? <ChevronDown size={16} className="theme-muted" /> : <ChevronRight size={16} className="theme-muted" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-sm theme-text leading-relaxed space-y-2 border-t theme-border-soft">
                    {s.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={openTriskellSite}
          title={`${t('studio.byLine')} — ${TRISKELL_URL}`}
          aria-label={`${t('studio.byLine')} — ouvrir triskell-studio.fr`}
          className="mt-10 pt-6 border-t theme-border-soft w-full flex items-center justify-center gap-1.5 text-xs theme-muted opacity-70 hover:opacity-100 hover:theme-text transition cursor-pointer"
        >
          <TriskellMark size={22} />
          <span className="text-sm">{t('studio.byLine')}</span>
        </button>
      </div>
    </div>
  );
}

function KBD({ children }: { children: React.ReactNode }) {
  return <kbd className="theme-kbd">{children}</kbd>;
}
