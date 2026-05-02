/**
 * Beta lifecycle guard.
 *
 * Each release is marked as beta and has a hard expiry of N days from the
 * first time the user opens this specific version on their machine. Once
 * expired, the app displays a blocking screen until the user installs a
 * newer build. The "first seen" timestamp is stored per-version, so each
 * upgrade resets the countdown.
 *
 * To ship a non-beta release, set IS_BETA = false (the guard becomes a no-op).
 */

import { CURRENT_VERSION } from './components/WhatsNew';

export const IS_BETA = true;
export const BETA_EXPIRY_DAYS = 7;

const FIRST_SEEN_KEY = 'delinote.beta.firstSeen.';

export type BetaStatus = {
  isBeta: boolean;
  expired: boolean;
  daysLeft: number;
  hoursLeft: number;
  firstSeen: number;
  expiresAt: number;
  version: string;
};

/**
 * Reads (and on first call writes) the per-version "first seen" timestamp
 * and computes whether the beta has expired.
 */
export function checkBetaStatus(): BetaStatus {
  if (!IS_BETA) {
    return {
      isBeta: false, expired: false, daysLeft: Infinity, hoursLeft: Infinity,
      firstSeen: Date.now(), expiresAt: Infinity, version: CURRENT_VERSION,
    };
  }
  const key = FIRST_SEEN_KEY + CURRENT_VERSION;
  let firstSeen: number;
  try {
    const stored = localStorage.getItem(key);
    if (stored && /^\d+$/.test(stored)) {
      firstSeen = parseInt(stored, 10);
    } else {
      firstSeen = Date.now();
      localStorage.setItem(key, String(firstSeen));
    }
  } catch {
    firstSeen = Date.now();
  }
  const expiresAt = firstSeen + BETA_EXPIRY_DAYS * 86_400_000;
  const msLeft = expiresAt - Date.now();
  const expired = msLeft <= 0;
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
  const hoursLeft = Math.max(0, Math.ceil(msLeft / 3_600_000));
  return { isBeta: true, expired, daysLeft, hoursLeft, firstSeen, expiresAt, version: CURRENT_VERSION };
}
