import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './index.css';

// One-time localStorage migration: legacy `fevernote.*` keys → `delinote.*`.
// Idempotent (sentinel-gated). Safe to remove once all known users have launched a delinote build.
(function migrateLegacyLocalStorageKeys() {
  const SENTINEL = 'delinote.migration.localstorage.v1';
  try {
    if (localStorage.getItem(SENTINEL) === '1') return;
    const pairs: Array<[string, string]> = [
      ['fevernote.tabs.v1',          'delinote.tabs.v1'],
      ['fevernote.notifications.v1', 'delinote.notifications.v1'],
      ['fevernote.onboarding.done',  'delinote.onboarding.done'],
    ];
    for (const [oldKey, newKey] of pairs) {
      const v = localStorage.getItem(oldKey);
      if (v === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, v);
      localStorage.removeItem(oldKey);
    }
    localStorage.setItem(SENTINEL, '1');
  } catch { /* best-effort: localStorage may be unavailable */ }
})();

// Surface uncaught errors so a blank window never happens silently again.
window.addEventListener('error', (e) => console.error('[DéliNote] window error:', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[DéliNote] unhandled promise:', e.reason));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
