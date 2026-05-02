// One-shot helper: writes 10 demo notes into the user's DeliNote data folder.
// Run via: node scripts/seed-notes.mjs
//
// Notes are structured Tiptap JSON so they render with proper headings, lists,
// tasks and colors in the editor.

import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';
import os from 'os';

const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const DATA_DIR = path.join(APPDATA, 'delinote', 'DeliNoteData');
const NOTES_DIR = path.join(DATA_DIR, 'notes');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');

function id() { return randomBytes(16).toString('hex'); }

function p(text) { return { type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }; }
function h(level, text) { return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }; }
function bullets(items) {
  return { type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [p(t)] })) };
}
function ordered(items) {
  return { type: 'orderedList', content: items.map((t) => ({ type: 'listItem', content: [p(t)] })) };
}
function tasks(items) {
  return {
    type: 'taskList',
    content: items.map(([text, checked]) => ({
      type: 'taskItem',
      attrs: { checked },
      content: [p(text)],
    })),
  };
}
function quote(text) { return { type: 'blockquote', content: [p(text)] }; }
function bold(text) { return { type: 'text', text, marks: [{ type: 'bold' }] }; }
function plain(text) { return { type: 'text', text }; }

const NOTES = [
  {
    title: '🎯 Idées de projet',
    pinned: true,
    color: 'orange',
    tags: ['idées', 'projets'],
    doc: [
      h(2, 'Idées en vrac'),
      bullets([
        'App de suivi des plantes (arrosage, exposition)',
        'Tracker de lectures avec graphique annuel',
        'Plugin VS Code pour timer Pomodoro',
        'Site vitrine pour les studios indépendants',
      ]),
      h(2, 'À approfondir'),
      tasks([
        ['Faire un mockup Figma de l\'app plantes', false],
        ['Étudier la concurrence (Planta, Greg)', false],
        ['Lister les features minimales MVP', true],
      ]),
    ],
  },
  {
    title: '🛒 Courses de la semaine',
    pinned: false,
    color: 'green',
    tags: ['courses', 'maison'],
    doc: [
      h(3, 'Frais'),
      tasks([
        ['Tomates cerises', false],
        ['Mozzarella di bufala', false],
        ['Basilic frais', false],
        ['Œufs bio (×6)', true],
        ['Saumon fumé', false],
      ]),
      h(3, 'Sec'),
      tasks([
        ['Pâtes spaghetti', false],
        ['Riz basmati', false],
        ['Café en grains', true],
        ['Lait d\'avoine', false],
      ]),
      h(3, 'Maison'),
      tasks([
        ['Lessive', false],
        ['Liquide vaisselle', false],
      ]),
    ],
  },
  {
    title: 'Réunion équipe — sprint planning',
    pinned: false,
    color: 'blue',
    tags: ['réunion', 'travail'],
    doc: [
      h(2, 'Participants'),
      bullets(['Jordan (PO)', 'Sarah (Lead Dev)', 'Marc (Design)', 'Léa (QA)']),
      h(2, 'Objectifs du sprint'),
      ordered([
        'Finaliser l\'onboarding utilisateur',
        'Corriger les 5 bugs prio sur le ticket #234',
        'Préparer la démo client pour vendredi',
      ]),
      h(2, 'Décisions'),
      bullets([
        'On reporte la migration BDD au sprint suivant',
        'Marc est référent UX cette semaine',
        'Stand-ups maintenus à 9h30 sauf vendredi',
      ]),
      h(2, 'Action items'),
      tasks([
        ['Sarah : créer le ticket migration pour S+1', false],
        ['Marc : valider les wireframes onboarding avec Jordan', false],
        ['Léa : préparer le scénario de démo', false],
        ['Jordan : envoyer l\'invit démo au client avant mercredi', false],
      ]),
    ],
  },
  {
    title: '🍝 Pâtes alla carbonara (la vraie)',
    pinned: false,
    color: 'yellow',
    tags: ['recettes', 'cuisine'],
    doc: [
      h(2, 'Ingrédients (2 personnes)'),
      bullets([
        '200 g de spaghetti ou rigatoni',
        '100 g de guanciale (à défaut, pancetta)',
        '2 jaunes d\'œufs + 1 œuf entier',
        '60 g de pecorino romano râpé',
        'Poivre noir fraîchement moulu',
        'Sel pour l\'eau de cuisson',
      ]),
      h(2, 'Étapes'),
      ordered([
        'Couper le guanciale en lardons épais et le faire revenir doucement à sec.',
        'Battre les œufs avec le pecorino et beaucoup de poivre.',
        'Cuire les pâtes al dente dans l\'eau salée.',
        'Hors du feu, mélanger les pâtes égouttées avec le guanciale et son gras.',
        'Verser le mélange œuf-pecorino, mélanger vivement avec un peu d\'eau de cuisson pour crémer.',
        'Servir immédiatement avec encore un tour de poivre.',
      ]),
      quote('Surtout ne jamais cuire les œufs sur le feu — la chaleur résiduelle suffit !'),
    ],
  },
  {
    title: '📚 Livres à lire en 2026',
    pinned: false,
    color: 'purple',
    tags: ['lectures', 'objectifs'],
    doc: [
      h(2, 'Fiction'),
      tasks([
        ['Le Comte de Monte-Cristo — Alexandre Dumas', false],
        ['Project Hail Mary — Andy Weir', true],
        ['Tomorrow, and Tomorrow, and Tomorrow — Gabrielle Zevin', false],
      ]),
      h(2, 'Non-fiction'),
      tasks([
        ['Atomic Habits — James Clear', true],
        ['Deep Work — Cal Newport', false],
        ['Sapiens — Yuval Noah Harari', false],
        ['The Pragmatic Programmer (20th)', false],
      ]),
      h(2, 'Wishlist'),
      bullets([
        'Tout ce qu\'on peut écrire sur le sujet du flow (Csíkszentmihályi)',
        'Une bonne biographie de Steve Jobs ou Iwata',
      ]),
    ],
  },
  {
    title: '💡 Notes — Atomic Habits',
    pinned: false,
    color: '',
    tags: ['lectures', 'productivité'],
    doc: [
      h(2, 'Idée principale'),
      p('Les petites habitudes (1% mieux par jour) composent à long terme. Le système bat l\'objectif.'),
      h(2, 'Citations marquantes'),
      quote('You do not rise to the level of your goals. You fall to the level of your systems.'),
      quote('Habits are the compound interest of self-improvement.'),
      h(2, 'Les 4 lois'),
      ordered([
        { type: 'paragraph', content: [bold('Make it obvious'), plain(' — environnement, déclencheurs visibles')] },
        { type: 'paragraph', content: [bold('Make it attractive'), plain(' — bundling avec une activité plaisante')] },
        { type: 'paragraph', content: [bold('Make it easy'), plain(' — règle des 2 minutes')] },
        { type: 'paragraph', content: [bold('Make it satisfying'), plain(' — récompense immédiate')] },
      ].map((para) => ({ type: 'listItem', content: [para] }))),
      h(2, 'À tester cette semaine'),
      tasks([
        ['Préparer mes affaires de sport la veille au soir', false],
        ['Lecture obligatoire 10 pages avant de regarder une série', false],
        ['Habit stacking : méditation juste après le café du matin', false],
      ]),
    ],
  },
  {
    title: '🏋️ Routine sport — semaine type',
    pinned: false,
    color: 'red',
    tags: ['sport', 'santé'],
    doc: [
      h(2, 'Lundi — Push (pec/épaules/triceps)'),
      bullets([
        'Développé couché barre 4×8',
        'Développé épaules haltères 3×10',
        'Dips lestés 3×8',
        'Élévations latérales 3×12',
      ]),
      h(2, 'Mercredi — Pull (dos/biceps)'),
      bullets([
        'Tractions 4×6 (lestées si possible)',
        'Rowing barre 4×8',
        'Tirage poulie haute 3×10',
        'Curl haltères 3×10',
      ]),
      h(2, 'Vendredi — Legs'),
      bullets([
        'Squat barre 4×8',
        'Soulevé de terre roumain 3×10',
        'Presse à cuisses 3×12',
        'Mollets debout 4×15',
      ]),
      h(2, 'Cardio'),
      p('Mardi/Jeudi : 30 min vélo modéré + 10 min étirements.'),
      h(2, 'Notes'),
      bullets([
        'Toujours échauffer 5-10 min avant',
        'Repos minimum 90s entre séries lourdes',
        'Hydratation : 1 bouteille pendant la séance',
      ]),
    ],
  },
  {
    title: '✈️ Préparation voyage Lisbonne',
    pinned: true,
    color: 'blue',
    tags: ['voyage', 'lisbonne', 'à-faire'],
    doc: [
      h(2, 'Dates'),
      p('Du 14 au 21 juin — 7 nuits, vol Air France direct depuis CDG.'),
      h(2, 'Logement'),
      bullets([
        'Hôtel Memmo Alfama — confirmation #LX-44839',
        'Check-in 15h le 14, check-out 11h le 21',
      ]),
      h(2, 'À voir / faire'),
      tasks([
        ['Belém + Tour de Belém + Pasteis de Belém', false],
        ['Quartier Alfama au coucher du soleil', false],
        ['Tram 28 (tôt le matin pour éviter la foule)', false],
        ['Sintra journée entière (Pena + Quinta da Regaleira)', false],
        ['LX Factory — soirée bars/restos', false],
        ['Cascais en train depuis Cais do Sodré', false],
        ['Time Out Market pour la street food', false],
      ]),
      h(2, 'Restaurants à réserver'),
      bullets([
        'Cervejaria Ramiro (fruits de mer, attente longue)',
        'O Velho Eurico (cuisine portugaise moderne)',
        'A Cevicheria (fusion, sans réservation)',
      ]),
      h(2, 'Avant de partir'),
      tasks([
        ['Vérifier validité passeport / CNI', true],
        ['Imprimer les billets et la conf hôtel', false],
        ['Carte bancaire sans frais à l\'étranger', true],
        ['Adaptateur prise (pas nécessaire pour le PT mais on sait jamais)', false],
        ['Prévenir la banque', false],
        ['Télécharger Citymapper Lisbonne', false],
      ]),
    ],
  },
  {
    title: '💻 Setup nouvel ordinateur',
    pinned: false,
    color: '',
    tags: ['tech', 'setup'],
    doc: [
      h(2, 'Apps essentielles'),
      tasks([
        ['DéliNote (évidemment)', true],
        ['VS Code + extensions habituelles', true],
        ['Node.js LTS via fnm', true],
        ['Git + config user.name/email', true],
        ['Firefox + Bitwarden', true],
        ['Discord / Slack', false],
        ['Spotify', true],
        ['VLC', false],
        ['Steam', false],
      ]),
      h(2, 'Configuration système'),
      bullets([
        'Désactiver le télémétrie Windows',
        'Mode sombre activé partout',
        'PowerToys (FancyZones + PowerRename)',
        'Activer WSL2 + Ubuntu',
      ]),
      h(2, 'Restauration des données'),
      tasks([
        ['Cloner les repos GitHub principaux', false],
        ['Importer les bookmarks navigateur', false],
        ['Restaurer la config dotfiles', false],
        ['Vérifier que l\'export DéliNote s\'importe bien', false],
      ]),
    ],
  },
  {
    title: '📊 Objectifs Q2 2026',
    pinned: true,
    color: 'green',
    tags: ['objectifs', 'travail', 'perso'],
    doc: [
      h(2, 'Pro'),
      ordered([
        'Sortir DéliNote 1.0 stable avant fin juin',
        'Publier 3 articles techniques sur le blog',
        'Atteindre 100 utilisateurs actifs sur les apps Triskell',
      ]),
      h(2, 'Perso'),
      ordered([
        'Lire 6 livres (1 par mois minimum)',
        'Reprendre le sport 3×/semaine sans interruption',
        'Voyage à Lisbonne en juin ✈️',
        'Apprendre les bases du portugais (Duolingo quotidien)',
      ]),
      h(2, 'Suivi mensuel'),
      bullets([
        'Avril — review prévue le 30/04',
        'Mai — review prévue le 31/05',
        'Juin — bilan + planification Q3 le 30/06',
      ]),
      quote('Done is better than perfect. Mais pas n\'importe quoi non plus.'),
    ],
  },
];

function countWords(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function plainTextOf(node) {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) return node.content.map(plainTextOf).join(' ');
  return '';
}

async function main() {
  await fs.mkdir(NOTES_DIR, { recursive: true });
  const idx = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
  if (!Array.isArray(idx.notes)) idx.notes = [];

  const inboxId = idx.notebooks?.[0]?.id ?? 'inbox';
  const now = Date.now();

  let added = 0;
  for (let i = 0; i < NOTES.length; i++) {
    const spec = NOTES[i];
    const noteId = id();
    const doc = { type: 'doc', content: spec.doc };
    const text = plainTextOf(doc);
    const created = now - (NOTES.length - i) * 60_000 * 30; // staggered every 30 min back
    const note = {
      id: noteId,
      title: spec.title,
      notebookId: inboxId,
      tags: spec.tags ?? [],
      pinned: !!spec.pinned,
      color: spec.color ?? '',
      createdAt: created,
      updatedAt: created + Math.floor(Math.random() * 5_000),
      trashed: false,
      excerpt: text.slice(0, 200).replace(/\s+/g, ' ').trim(),
      wordCount: countWords(text),
      content: JSON.stringify(doc),
      text,
    };
    await fs.writeFile(path.join(NOTES_DIR, `${noteId}.json`), JSON.stringify(note, null, 2), 'utf8');
    idx.notes.unshift({
      id: note.id,
      title: note.title,
      notebookId: note.notebookId,
      tags: note.tags,
      pinned: note.pinned,
      color: note.color,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      trashed: note.trashed,
      excerpt: note.excerpt,
      wordCount: note.wordCount,
    });
    added++;
  }
  await fs.writeFile(INDEX_PATH, JSON.stringify(idx, null, 2), 'utf8');
  console.log(`OK — ${added} notes ajoutées dans ${NOTES_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
