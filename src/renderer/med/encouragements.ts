/**
 * Encouragement messages for the medication tracker.
 * Picks a contextually appropriate, kind, non-judgmental line based on
 * today's progress and the user's recent streak.
 */

import { useSettings } from '../settings';

type Bucket =
  | 'allTakenToday'
  | 'partialToday'
  | 'nothingTakenYet'
  | 'allUpcomingToday'
  | 'noScheduleToday'
  | 'streakStarting'    // 1-2 days
  | 'streakGood'        // 3-6
  | 'streakGreat'       // 7-13
  | 'streakChampion'    // 14+
  | 'brokeStreak'       // missed yesterday
  | 'noMedsConfigured'
  | 'takenJustNow'
  | 'lowStock'
  | 'fresh';

const FR: Record<Bucket, string[]> = {
  allTakenToday: [
    "Tout pris aujourd'hui — fier·e de toi 🎉",
    "Routine complétée. Tu prends soin de toi, et ça compte.",
    "Mission du jour : accomplie. Continue comme ça.",
    "Bravo, ta journée santé est bouclée.",
  ],
  partialToday: [
    "Bon début ! Encore quelques-uns à prendre.",
    "Tu y es presque, reste concentré·e.",
    "C'est en bonne voie, continue tranquillement.",
    "Une étape à la fois, tu gères.",
  ],
  nothingTakenYet: [
    "Nouvelle journée, nouveau départ. Tu peux le faire.",
    "Doucement mais sûrement, c'est le moment d'attaquer.",
    "Prends ton temps, mais n'oublie pas — tu te dois ça.",
  ],
  allUpcomingToday: [
    "Tout est devant toi. Une étape à la fois.",
    "La journée est jeune — on prend ça calmement.",
  ],
  noScheduleToday: [
    "Rien de prévu aujourd'hui — profite de ta journée !",
    "Journée libre côté traitement. Repose-toi bien.",
  ],
  streakStarting: [
    "Belle reprise ! La régularité commence ici.",
    "Premier·s jour·s posé·s — on continue.",
  ],
  streakGood: [
    "{n} jours d'affilée — la routine s'installe joliment.",
    "{n} jours sans oubli, c'est une vraie discipline.",
    "Tu enchaînes — ton corps te dit merci.",
  ],
  streakGreat: [
    "Une semaine entière sans accroc, chapeau bas.",
    "{n} jours — tu peux être fier·e de toi.",
    "Une habitude solide se forme. Magnifique.",
  ],
  streakChampion: [
    "{n} jours d'affilée — tu es un·e champion·ne 👑",
    "{n} jours de discipline. Tu es un exemple.",
    "Une telle constance, c'est inspirant.",
  ],
  brokeStreak: [
    "Pas grave si tu as oublié hier. Aujourd'hui est neuf.",
    "Une mauvaise journée n'efface pas tes efforts. On continue.",
    "Personne n'est parfait. L'important c'est de reprendre.",
  ],
  noMedsConfigured: [
    "Ajoute ton premier médicament pour démarrer le suivi.",
    "Renseigne tes traitements ici — je m'occuperai des rappels.",
  ],
  takenJustNow: [
    "Bien joué !",
    "Bel effort.",
    "Une de plus, bravo.",
    "Continue comme ça.",
    "Ta santé te remercie.",
    "Discipline + douceur, c'est le combo gagnant.",
  ],
  lowStock: [
    "Pense à renouveler — tu y es presque.",
    "Stock bas pour {name}, anticipe la prochaine ordonnance.",
  ],
  fresh: [
    "On est ensemble dans cette routine. Tu n'es pas seul·e.",
    "Prendre soin de toi, c'est aussi un acte de courage.",
    "Une journée à la fois, c'est tout ce qu'il faut.",
  ],
};

const EN: Record<Bucket, string[]> = {
  allTakenToday: [
    "All done for today — proud of you 🎉",
    "Routine complete. You take care of yourself, and it shows.",
    "Mission accomplished. Keep it up.",
    "Today's wellness wrapped up. Bravo.",
  ],
  partialToday: [
    "Good start! A few more to go.",
    "You're almost there, stay focused.",
    "On the right track — easy does it.",
    "One step at a time, you've got this.",
  ],
  nothingTakenYet: [
    "New day, fresh start. You can do this.",
    "Take it slow, but don't forget — you owe it to yourself.",
  ],
  allUpcomingToday: [
    "All ahead of you. One step at a time.",
    "The day is young — let's pace ourselves.",
  ],
  noScheduleToday: [
    "Nothing scheduled today — enjoy your day!",
    "A free day on the treatment side. Rest well.",
  ],
  streakStarting: [
    "Great restart! Consistency starts here.",
    "First day(s) on the board — let's keep going.",
  ],
  streakGood: [
    "{n} days in a row — your routine is taking shape nicely.",
    "{n} days without missing — that's real discipline.",
    "You're stacking days — your body thanks you.",
  ],
  streakGreat: [
    "A full week without a hitch, hats off.",
    "{n} days — you can be proud.",
    "A solid habit is forming. Beautiful.",
  ],
  streakChampion: [
    "{n} straight days — you're a champion 👑",
    "{n} days of discipline. Inspiring.",
    "Such consistency is rare. Bravo.",
  ],
  brokeStreak: [
    "It's OK if you missed yesterday. Today is new.",
    "One bad day doesn't erase your effort. Let's continue.",
    "Nobody is perfect. What matters is picking it back up.",
  ],
  noMedsConfigured: [
    "Add your first medication to start tracking.",
    "List your treatments here — I'll handle the reminders.",
  ],
  takenJustNow: [
    "Nicely done!",
    "Good work.",
    "One more, bravo.",
    "Keep it up.",
    "Your health thanks you.",
    "Discipline plus kindness — that's the winning combo.",
  ],
  lowStock: [
    "Think about a refill — you're getting close.",
    "Low on {name}, plan ahead for the next prescription.",
  ],
  fresh: [
    "We're in this routine together. You're not alone.",
    "Taking care of yourself is also an act of courage.",
    "One day at a time — that's all it takes.",
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] ?? '';
}

export function getEncouragement(opts: {
  totalToday: number;
  takenToday: number;
  upcomingToday: number;
  streakDays: number;
  brokeYesterday: boolean;
  hasMeds: boolean;
}): string {
  const lang = useSettings.getState().settings.language;
  const dict = lang === 'fr' ? FR : EN;

  if (!opts.hasMeds) return pick(dict.noMedsConfigured);
  if (opts.totalToday === 0) return pick(dict.noScheduleToday);

  // Streak-based message wins if it's noteworthy
  if (opts.streakDays >= 14) return pick(dict.streakChampion).replace('{n}', String(opts.streakDays));
  if (opts.streakDays >= 7) return pick(dict.streakGreat).replace('{n}', String(opts.streakDays));
  if (opts.streakDays >= 3) return pick(dict.streakGood).replace('{n}', String(opts.streakDays));
  if (opts.brokeYesterday) return pick(dict.brokeStreak);
  if (opts.streakDays >= 1) return pick(dict.streakStarting);

  // Today-progress based
  if (opts.takenToday === opts.totalToday) return pick(dict.allTakenToday);
  if (opts.takenToday > 0) return pick(dict.partialToday);
  if (opts.upcomingToday > 0 && opts.takenToday === 0) return pick(dict.allUpcomingToday);
  return pick(dict.fresh);
}

export function getTakenJustNowMessage(): string {
  const lang = useSettings.getState().settings.language;
  return pick((lang === 'fr' ? FR : EN).takenJustNow);
}

export function getLowStockMessage(name: string): string {
  const lang = useSettings.getState().settings.language;
  return pick((lang === 'fr' ? FR : EN).lowStock).replace('{name}', name);
}
