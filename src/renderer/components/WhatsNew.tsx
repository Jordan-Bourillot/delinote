import { useState } from 'react';
import { Sparkles, X, Check, ChevronRight } from 'lucide-react';
import { Logo } from './Logo';
import { TriskellMark } from './TriskellMark';

const SEEN_KEY = 'delinote.whatsNewSeenVersion';

/**
 * Versioned changelog entries shown in the "What's new" popup.
 * Add a new entry at the top whenever you ship a feature or fix.
 * The user only sees entries newer than the version they last acknowledged.
 */
type Entry = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const CHANGELOG: Entry[] = [
  {
    version: '0.9.9',
    date: '2026-05-03',
    title: 'Offrir DéliNote + Programme de parrainage',
    highlights: [
      '🎁 **Offre DéliNote** à un proche : nouvelle section dans Réglages avec un formulaire (email du destinataire, prénom, petit mot). Un clic ouvre le paiement Stripe pré-rempli — la licence part automatiquement par mail au destinataire',
      '🤝 **Programme de parrainage** : ton code parrain unique de 8 caractères s\'affiche dans les Réglages, copiable d\'un clic, partageable par mail / WhatsApp / Web Share',
      '💰 **5 € par filleul** qui achète DéliNote avec ton code. Sans plafond, sans engagement. Paiement par virement à partir de 20 €, ou en bons à valoir sur d\'autres apps Triskell Studio',
      '✅ **Stripe branché** : le bouton « Acheter » sur le site marche enfin pour de vrai. Les codes parrain partagés via lien sont automatiquement attribués à la transaction',
    ],
  },
  {
    version: '0.9.8',
    date: '2026-05-03',
    title: 'Triskèle redessiné + crédit Triskell Studio en bouton-pilule',
    highlights: [
      '🪶 **Nouveau triskèle SVG** : 3 pétales en feuille strictement symétriques (orange / indigo / or) à 120° pile, contour fin pour bien dessiner les bords. Cœur navy avec un anneau blanc fin — lisible sur fond clair ET sur badge coloré',
      '🏷️ **Crédit « propulsé par Triskell Studio » sur l\'accueil** dans un bouton-pilule avec fond opaque + bordure douce + ombre légère. Plus aucune ligne horizontale ne le traverse',
    ],
  },
  {
    version: '0.9.7',
    date: '2026-05-03',
    title: 'Logo Triskell Studio rendu visible dans la pop-up Nouveautés',
    highlights: [
      '✨ Le logo « propulsé par Triskell Studio » en bas de cette pop-up passe d\'un mini triskèle à 11 px noyé dans le gris à un **badge dégradé turquoise→indigo de 28 px** avec le triskèle bien visible. Studio name en orange accent, texte normal',
    ],
  },
  {
    version: '0.9.6',
    date: '2026-05-03',
    title: 'Mise à jour : on te dit ce qui se passe',
    highlights: [
      '🔄 **Dialogue d\'installation détaillé** : 4 étapes visibles (Préparation → Fermeture → Installation → Relance) avec icônes de progression. Tu sais à chaque seconde ce qui se passe, fini le « trou noir »',
      '🪟 **Installeur Windows visible** : la fenêtre NSIS s\'affiche pendant le remplacement des fichiers (~10 sec). Tu vois la barre de progression Windows au lieu d\'une fenêtre fermée',
      '📦 **Mises à jour différentielles** : à partir de cette version, les MAJ ne re-téléchargent plus que ce qui a changé (~10-30 Mo au lieu de 155 Mo). Tes prochains téléchargements seront 5-10x plus rapides',
      '🚀 **Démarrage plus propre** : la fenêtre attend d\'être prête à afficher avant de s\'ouvrir, plus de flash blanc au lancement. Splash screen avec logo animé pendant les premières millisecondes',
    ],
  },
  {
    version: '0.9.5',
    date: '2026-05-03',
    title: 'Logo Triskell Studio redessiné',
    highlights: [
      '🎨 **Nouveau triskèle Triskell Studio** : 3 pétales spiralées (orange · indigo · or) bien lisibles à toutes les tailles. Visible dans la sidebar, l\'écran d\'accueil, l\'écran « Bêta expirée » et la section « À propos »',
      '🪶 Détail mais soigné — un cœur blanc avec un liseré subtil donne du contraste sur tous les fonds',
    ],
  },
  {
    version: '0.9.4',
    date: '2026-05-02',
    title: 'Section Labo : 8 innovations + ton avis compte',
    highlights: [
      '🧪 **Nouvelle section « Labo »** dans Réglages avec 8 features expérimentales que tu peux activer/désactiver à la pièce. Sur chacune tu votes 👍 j\'aime · 🔧 à améliorer · 👎 pas d\'intérêt — un bouton « Envoyer mes retours » prépare un mail récapitulatif à Triskell Studio',
      '📦 **Auto-archive** : les notes que tu n\'as pas touchées depuis X jours (7-365, défaut 60) disparaissent doucement de la liste. Pas supprimées — juste cachées. Les épinglées/importantes/urgentes restent immunisées',
      '🕰️ **Retour dans le temps** : menu « ... » de l\'éditeur → un slider sur l\'historique d\'instantanés de la note. Glisse pour voir une version passée, clique « Restaurer » pour la ramener',
      '🌌 **Murmure (vraie IA locale)** : un panneau discret bottom-right qui suggère 3 notes proches sémantiquement de celle ouverte. Embeddings ~25 Mo chargés une fois, tout tourne offline ensuite. Score de similarité affiché en %',
      '⚡ **Mode Flux** : bouton sidebar pour 25 min d\'écriture en continu plein écran (timer Pomodoro). À la fin, l\'app propose de découper le texte en plusieurs notes thématiques que tu valides',
      '🎙️ **Notes vocales spatiales** : l\'enregistreur audio capture date+heure et l\'événement de calendrier en cours, et l\'inscrit en haut de la transcription. Tu retrouves « ce que je pensais en sortant du dentiste mardi soir »',
      '🎨 **Mood-board** : un canvas libre par note (menu « ... » → « Mood-board de cette note »). Glisse images, double-clic pour pense-bête, colle du texte/image. Aussi accessible en mode global depuis la sidebar',
      '🔋 **Anti-calendrier Énergie** : 3 voies (haute/moyenne/basse énergie). Glisse-y tes rappels ET tes évènements de calendrier selon le niveau d\'énergie qu\'ils demandent. Plus parlant que des cases horaires rigides',
      '📱 **QR Share** : génère un QR code → ton ami scanne avec son téléphone (même Wi-Fi) → il lit la note dans son navigateur. **Mode live** : édition synchronisée des deux côtés en temps réel via un mini serveur HTTP local. 100 % offline, expire après 1 h',
      '🖼️ **Image de fond personnalisée** dans Réglages → Apparence : choisis une photo, règle l\'opacité 0-100 %',
      '🐛 **Bug cloche corrigé** : le panneau de notifications s\'ouvrait hors écran à gauche — il s\'ouvre maintenant correctement vers la droite',
      '✨ **« propulsé par Triskell Studio »** au lieu de « par Triskell Studio » — détail mais on l\'aime mieux',
    ],
  },
  {
    version: '0.9.3',
    date: '2026-05-02',
    title: 'Notes prioritaires + dialogue de mise à jour',
    highlights: [
      '⭐ **Notes importantes** : un nouveau bouton (étoile) dans la barre d\'édition encadre la note d\'un **liseré jaune** pour la repérer du premier coup d\'œil. Disponible aussi via clic droit sur n\'importe quelle note',
      '⚡ **Notes urgentes** : un autre bouton (éclair) ajoute un **liseré bleu**. Combinable avec « importante » → cadre jaune + ring bleu',
      '🔔 **Clignotement optionnel** des notes urgentes pour attirer l\'attention. Activable/désactivable dans Réglages → Note → « Faire clignoter les notes urgentes ». Respecte la préférence système « réduire les animations »',
      '🔄 **Dialogue de mise à jour** : quand tu cliques « Installer maintenant » dans le bandeau orange, l\'app affiche désormais un message clair (« DéliNote va se fermer pour installer la nouvelle version, puis se relancera automatiquement ») au lieu du formulaire de retour bêta — l\'app comprend que tu n\'es pas en train de fermer pour de vrai',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-05-02',
    title: 'Test grandeur nature de l\'auto-update',
    highlights: [
      '🧪 **Première mise à jour automatique** poussée pour valider la chaîne complète : si tu lis ces lignes, c\'est que ton DéliNote 0.9.0 a détecté la 0.9.1, l\'a téléchargée, installée, et redémarrée — sans que tu aies eu à réinstaller manuellement. Le système marche 🚀',
      '✨ À partir de maintenant, toutes les futures versions arrivent automatiquement chez toi à chaque démarrage',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-05-02',
    title: 'Mises à jour automatiques — fini les exe à renvoyer',
    highlights: [
      '🔄 **Auto-update** : DéliNote vérifie discrètement les mises à jour à chaque démarrage. Quand une nouvelle version est dispo, elle se télécharge en arrière-plan, et un bandeau t\'invite à l\'installer en un clic — sans rien réinstaller manuellement',
      '📊 **Bandeau de mise à jour** en haut de l\'app pendant le téléchargement (barre de progression, débit) puis « Installer maintenant » quand c\'est prêt',
      '⚙️ **Section « Mises à jour »** dans les Réglages : version installée, état actuel, bouton « Vérifier maintenant » pour déclencher manuellement',
      '🔇 **Vérification silencieuse** : aucun bruit visuel si tu es déjà à jour. Les notifications n\'apparaissent que quand quelque chose te concerne',
      '📦 **Hébergement** : les mises à jour sont distribuées via GitHub Releases — gratuit, fiable, contrôlable',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-05-02',
    title: 'Encart de profil permanent dans la sidebar',
    highlights: [
      '🎯 **Encart de profil** désormais visible en bas de la sidebar pour **tous les profils** (Découverte / Équilibré / Complète / Personnalisé) — tu sais en permanence sur quel mode tu es',
      '🔄 **Bouton « Changer »** intégré à l\'encart : un clic ouvre la modale de sélection des 3 profils, sans passer par les Réglages',
      '⚙️ **Lien direct vers les Réglages** depuis l\'encart, avec rappel : « Tout est activable dans les Réglages » — pour les utilisateurs qui veulent ajuster une fonction à la pièce',
      '🎨 **Code couleur** par profil : vert (Découverte), orange (Équilibré), turquoise (Complète), violet (Personnalisé) — repérage visuel instantané',
    ],
  },
  {
    version: '0.8.1',
    date: '2026-05-02',
    title: 'Correctif crash au lancement (React error #310)',
    highlights: [
      '🐛 **Crash au démarrage corrigé** : la 0.8.0 plantait à l\'ouverture avec « React error #310 » à cause d\'un hook React mal placé (le useEffect du fallback de vue était appelé après les early-returns de loading/beta-expirée). Repositionné correctement — l\'app démarre proprement',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-05-02',
    title: 'Profils d\'utilisation : DéliNote s\'adapte à ton niveau',
    highlights: [
      '🎯 **3 profils d\'utilisation** au premier lancement : **Découverte** (l\'essentiel pour démarrer), **Équilibré** (recommandé, l\'usage quotidien), **Complète** (toutes les fonctions). Les nouveaux utilisateurs ne sont plus noyés sous les options',
      '⚙️ **Profil modifiable** à tout moment dans Réglages → « Profil d\'utilisation ». Tes notes, ton thème et tes paramètres personnels sont préservés au changement',
      '🌱 **Bandeau « Activer plus de fonctions »** discret en bas de la sidebar pour les utilisateurs en mode Découverte — un clic pour passer à un profil plus complet quand on se sent prêt',
      '🧰 **Modules désactivables** un par un : Agenda, Tâches, Fichiers, Contacts, Médicaments, Aide. Si tu n\'utilises pas un module, il disparaît proprement de la sidebar',
      '✏️ **Renommage** : « Boîte de réception » devient **« Notes rapides »** — plus clair, plus parlant. Migration automatique pour les utilisateurs existants',
      '🛡️ **Protection des utilisateurs existants** : si tu mets à jour, ton profil est marqué « Personnalisé » et la modale ne te dérange jamais (tes réglages restent intacts)',
    ],
  },
  {
    version: '0.7.7',
    date: '2026-05-02',
    title: 'Sélection multiple vraiment visible + bandeau Corbeille corrigé',
    highlights: [
      '🟠 **Ctrl+A enfin évident** : quand tu sélectionnes plusieurs notes (Ctrl+A ou Ctrl+clic), **chaque ligne** est maintenant teintée d\'un orange marqué (~38 %) avec une **bordure gauche pleine** et un léger pop d\'animation. Plus moyen de rater quelles notes sont sélectionnées',
      '🐛 **Bandeau Corbeille corrigé** : le bouton « 🗑 Corbeille » du bandeau orange était rogné quand le panneau de notes était étroit. La barre **passe maintenant sur deux lignes** automatiquement quand il manque de place — tous les boutons restent accessibles',
    ],
  },
  {
    version: '0.7.6',
    date: '2026-05-01',
    title: 'Note du jour, visite guidée, liens [[wiki]] et socle de synchro',
    highlights: [
      '📅 **Note du jour** : nouveau bouton dans la sidebar (raccourci **Ctrl+Maj+T**) qui ouvre — ou crée — automatiquement la note datée d\'aujourd\'hui. Idéal pour un journal de bord ou des notes quotidiennes',
      '🎓 **Visite guidée** au premier lancement : un petit tour interactif (sidebar → liste de notes → onglets → éditeur) pour découvrir DéliNote en 30 secondes. Réinitialisable via la console (`window.__resetTour()`)',
      '🔗 **Liens wiki [[entre notes]]** : tape `[[Titre d\'une note]]` dans l\'éditeur, ça devient un lien cliquable. Si la note n\'existe pas, un clic la crée. Activable/désactivable dans les Réglages',
      '🧪 **Bandeau bêta** persistant en haut de l\'app avec l\'email de retour Triskell Studio — un clic pour rédiger un retour, masquable pour la session',
      '🔄 **Socle de synchronisation (CRDT Yjs)** : chaque note a maintenant un fichier `.ydoc.bin` à côté de son JSON. Ça prépare la **synchronisation multi-appareils** (BYO dossier — Dropbox/OneDrive/Syncthing) qui arrivera dans une prochaine version',
    ],
  },
  {
    version: '0.7.5',
    date: '2026-05-02',
    title: 'Toolbar enrichie + sélection visible + accents email',
    highlights: [
      '🎨 **Toolbar éditeur enrichie** style Evernote/Notion : sélecteur de **police** (Sans/Serif/Monospace), **taille de texte** (12 → 60px), **couleur du texte**, **surlignage couleur** avec palette + color-picker, **exposant/indice** (x²/x₂), **retraits** indent/outdent, dropdown **alignement**, dropdown **titres**, menu **Plus** avec « Supprimer le formatage »',
      '👁️ **Sélection multiple ultra-visible** : quand tu sélectionnes des notes (Ctrl+A ou Ctrl+clic), un **bandeau orange** persistant apparaît en haut de la liste avec le compteur + actions (Épingler, Déplacer, Corbeille). Chaque note sélectionnée est **bien teintée** en couleur d\'accent avec une bordure gauche pleine — fini la sélection invisible',
      '✉️ **Bug accents email corrigé** : la pop-up de feedback à la fermeture **ASCII-folde** maintenant les accents pour le mailto (les "PÃ¨re" / "DÃ©liNote" sont finis), et un **bouton « Copier »** met la version riche (avec accents) dans le presse-papier — colle-la simplement dans ton mail si ton client supporte l\'UTF-8',
    ],
  },
  {
    version: '0.7.4',
    date: '2026-05-02',
    title: 'Petites corrections de traduction',
    highlights: [
      '🇫🇷 Remplacement de l\'expression bizarre **« chercher floue »** (traduction littérale ratée de « fuzzy search ») par **« recherche rapide »** dans le tour rapide, les astuces d\'accueil et la section Aide',
      '💡 Explication clarifiée : la recherche **tolère les fautes de frappe** (tu peux taper "réun" pour trouver "réunion", ou "lisbon" pour trouver "Lisbonne")',
    ],
  },
  {
    version: '0.7.3',
    date: '2026-05-02',
    title: 'Cycle bêta : 7 jours par version',
    highlights: [
      '⏱️ **Limite de 7 jours** par version — chaque release de DéliNote est marquée comme bêta et doit être renouvelée tous les 7 jours pour garantir que tu testes la version la plus récente',
      '🔵 **Badge dans la sidebar** affichant en permanence le nombre de jours restants (devient orange à 3 jours, rouge à 1 jour)',
      '🛑 **Écran de blocage** plein écran à l\'expiration, expliquant comment récupérer la nouvelle version (tes notes restent intactes dans `%APPDATA%\\delinote\\`)',
      '🔄 **Reset automatique** du compteur à chaque nouvelle version installée — tu repars pour 7 jours',
    ],
  },
  {
    version: '0.7.2',
    date: '2026-05-02',
    title: 'Étiquettes plus puissantes & import Evernote enrichi',
    highlights: [
      '🏷️ **Compteur d\'étiquettes** dans la sidebar — chaque tag affiche le nombre de notes qui le portent',
      '🖱️ **Clic droit sur une étiquette** pour la renommer (le rename se propage à toutes les notes) ou la retirer partout',
      '🔗 **Liens en bleu** avec curseur main au survol — bien visibles dans l\'éditeur',
      '📥 **Import Evernote enrichi** : les images intégrées dans tes notes ENEX sont maintenant préservées (en-media + résources base64 → images Tiptap inline)',
      '🎨 **Couleurs de texte et surlignage** Evernote conservés à l\'import',
    ],
  },
  {
    version: '0.7.1',
    date: '2026-05-02',
    title: 'Évènements, anniversaires et corrections',
    highlights: [
      '🎂 **Dates importantes** dans les fiches contact : anniversaire, mariage, évènements personnalisés, avec rappels (jusqu\'à 30 jours à l\'avance + le jour J)',
      '📅 **Évènements dans l\'agenda** : créer un évènement à n\'importe quelle date, avec heure, couleur, notes et rappels multiples',
      '🔔 **Notifications Windows** automatiques pour tes évènements et anniversaires (jour J et X jours avant)',
      '⌨️ **Ctrl+A** pour sélectionner toutes les fiches contacts ou toutes les notes visibles',
      '🗑 **Suppression en lot** des contacts (sélectionne avec Ctrl+A puis Suppr)',
      '🐛 **Bug corrigé** : une note n\'est plus marquée comme « modifiée » quand tu cliques juste dessus pour la lire',
      '✨ **Nouveautés** : cette pop-up apparaît à chaque mise à jour pour te dire ce qui change',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-01',
    title: 'Module Médicaments et Calendrier',
    highlights: [
      'Module Médicaments avec rappels et messages d\'encouragement',
      'Vue Calendrier (agenda mensuel)',
      'Vue Tâches centralisée',
      'Vue Fichiers (toutes les pièces jointes)',
      'Module Contacts avec WhatsApp',
      'Section Aide complète',
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? '0.0.0';

export function shouldShowWhatsNew(): boolean {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return true; // first launch ever (or first since this feature)
    return cmpVersions(seen, CURRENT_VERSION) < 0;
  } catch { return false; }
}

function cmpVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0, db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, CURRENT_VERSION); } catch { /* ignore */ }
}

export default function WhatsNewModal({ onClose }: { onClose: () => void }) {
  const seen = (() => {
    try { return localStorage.getItem(SEEN_KEY) ?? '0.0.0'; } catch { return '0.0.0'; }
  })();
  const newEntries = CHANGELOG.filter((e) => cmpVersions(e.version, seen) > 0);
  const entries = newEntries.length > 0 ? newEntries : [CHANGELOG[0]];
  const [idx, setIdx] = useState(0);
  const entry = entries[idx];
  const isLast = idx === entries.length - 1;

  function close() {
    markSeen();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm pop-in">
      <div className="theme-card border theme-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div
          className="px-6 py-5 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #F37223 0%, #fb923c 50%, #fbbf24 100%)' }}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Sparkles size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-white/80 font-semibold mb-1">
                Nouveautés · v{entry.version} · {formatDate(entry.date)}
              </div>
              <h2 className="text-xl font-bold">{entry.title}</h2>
            </div>
            <button onClick={close} className="text-white/70 hover:text-white shrink-0"><X size={16} /></button>
          </div>
          {entries.length > 1 && (
            <div className="flex gap-1.5 mt-3">
              {entries.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : i < idx ? 'w-3 bg-white/60' : 'w-3 bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-5 max-h-[55vh] overflow-y-auto">
          <ul className="space-y-3">
            {entry.highlights.map((line, i) => (
              <li key={i} className="flex items-start gap-3 text-sm theme-text">
                <Check size={16} className="theme-accent shrink-0 mt-0.5" />
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(line) }} />
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 py-3 border-t theme-border-soft theme-bg-soft flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs theme-text">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-white border theme-border-soft shadow-sm"
            >
              <TriskellMark size={18} />
            </span>
            <span className="font-medium">propulsé par <span className="theme-accent font-semibold">Triskell Studio</span></span>
          </div>
          <div className="flex-1" />
          {!isLast ? (
            <button
              onClick={() => setIdx(idx + 1)}
              className="text-sm px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1.5"
            >
              Suivant <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={close}
              className="text-sm px-5 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-1.5 font-medium"
            >
              <Check size={14} /> J'ai vu, c'est parti !
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(s: string): string {
  // Tiny inline markdown: **bold** and `code`
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="theme-pill px-1 py-0.5 rounded text-[11px]">$1</code>');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}
