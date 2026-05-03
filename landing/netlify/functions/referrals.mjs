// Admin endpoint exposing the referral data stored by stripe-webhook.mjs.
//
// Endpoints (all require ?token=ADMIN_TOKEN matching the env var):
//
//   GET  /api/referrals
//        Returns the full list of stored conversions (newest first).
//        Optional filters: ?ref=CODE, ?payout=pending|paid|cancelled
//
//   POST /api/referrals/markPaid
//        Body JSON: { sessionId: "cs_xxx" }
//        Toggles payoutStatus to "paid" so the merchant can track who's
//        already been compensated for which referral.
//
//   POST /api/referrals/markPending
//        Body JSON: { sessionId: "cs_xxx" }  (the inverse — undo)
//
// REQUIRED env var:
//   ADMIN_TOKEN  : a long random string. Bookmark the URL with the token.
//
// Set via:
//   netlify env:set ADMIN_TOKEN "$(node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\")"

import { getStore } from '@netlify/blobs';

function badRequest(msg) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return new Response(JSON.stringify({ ok: false, error: 'ADMIN_TOKEN not set on Netlify env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const headerToken = req.headers.get('x-admin-token') || '';
  const queryToken = url.searchParams.get('token') || '';
  if (headerToken !== adminToken && queryToken !== adminToken) return unauthorized();

  const store = getStore('referrals');

  // --- Mutation routes -----------------------------------------------------
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return badRequest('invalid JSON'); }
    const sessionId = body?.sessionId;
    if (!sessionId) return badRequest('missing sessionId');
    const existing = await store.get(sessionId, { type: 'json' });
    if (!existing) return badRequest('unknown sessionId');

    if (url.pathname.endsWith('/markPaid')) {
      existing.payoutStatus = 'paid';
      existing.paidAt = new Date().toISOString();
    } else if (url.pathname.endsWith('/markPending')) {
      existing.payoutStatus = 'pending';
      delete existing.paidAt;
    } else {
      return badRequest('unknown action');
    }
    await store.setJSON(sessionId, existing);
    return new Response(JSON.stringify({ ok: true, updated: existing }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Read route ----------------------------------------------------------
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const refFilter = (url.searchParams.get('ref') || '').toUpperCase();
  const payoutFilter = url.searchParams.get('payout') || ''; // "pending" | "paid" | "cancelled" | ""

  // List all keys, then fetch their JSON. Netlify Blobs is fast enough for
  // a few thousand rows here — once volume picks up, batch into chunks.
  const { blobs } = await store.list();
  const items = await Promise.all(
    blobs.map(async (b) => {
      try { return await store.get(b.key, { type: 'json' }); } catch { return null; }
    }),
  );
  const filtered = items
    .filter(Boolean)
    .filter((it) => !refFilter || (it.refCode || '').toUpperCase() === refFilter)
    .filter((it) => !payoutFilter || it.payoutStatus === payoutFilter)
    .sort((a, b) => (a.created < b.created ? 1 : -1));

  // Aggregate per referrer for a quick "who owes who" overview.
  const byReferrer = {};
  for (const it of filtered) {
    const code = (it.refCode || '').toUpperCase();
    if (!code) continue;
    if (!byReferrer[code]) byReferrer[code] = { code, count: 0, paidCount: 0, pendingEur: 0, paidEur: 0 };
    byReferrer[code].count += 1;
    // Default reward per converted referral: 5 € (in cents). Tweak here or
    // make this configurable per-tier later.
    const rewardCents = 500;
    if (it.payoutStatus === 'paid') {
      byReferrer[code].paidCount += 1;
      byReferrer[code].paidEur += rewardCents / 100;
    } else if (it.payoutStatus === 'pending') {
      byReferrer[code].pendingEur += rewardCents / 100;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      count: filtered.length,
      items: filtered,
      byReferrer: Object.values(byReferrer).sort((a, b) => b.pendingEur - a.pendingEur),
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
};

export const config = {
  path: ['/api/referrals', '/api/referrals/markPaid', '/api/referrals/markPending'],
};
