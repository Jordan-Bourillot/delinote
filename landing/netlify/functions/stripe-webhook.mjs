// Stripe webhook handler — receives `checkout.session.completed` events
// (and friends), verifies the signature, and persists the relevant fields
// in a Netlify Blobs store named "referrals".
//
// What we store, keyed by Stripe session id:
//   {
//     id              : "cs_xxx"
//     created         : ISO timestamp
//     amount          : integer cents (e.g. 2900 for 29 €)
//     currency        : "eur"
//     customerEmail   : the buyer's email
//     customerName    : the buyer's name (when provided)
//     refCode         : the referrer's code from client_reference_id (or "")
//     giftRecipient   : email entered in the "Email du destinataire" custom field
//     giftMessage     : the optional short message
//     paymentStatus   : "paid" | "unpaid" | "no_payment_required"
//     payoutStatus    : "pending" | "paid" — toggled from the admin dashboard
//     stripePaymentUrl: link to the payment in the Stripe dashboard
//     raw             : the full event for forensics (truncated)
//   }
//
// REQUIRED env vars (set on Netlify → Project → Environment):
//   STRIPE_SECRET_KEY      : sk_live_... or sk_test_... — used to query
//                            ancillary objects if we ever need to.
//   STRIPE_WEBHOOK_SECRET  : whsec_... — copied from Stripe Dashboard
//                            → Developers → Webhooks → your endpoint.
//
// Endpoint URL to register in Stripe Dashboard:
//   https://delinote.triskell-studio.fr/api/stripe-webhook
//
// Stripe events to subscribe:
//   - checkout.session.completed   (the main one)
//   - checkout.session.async_payment_succeeded   (delayed payments)
//   - charge.refunded              (so we can mark refunds and revoke commissions)

import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error('[webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return new Response('Server not configured', { status: 500 });
  }

  const stripe = new Stripe(secretKey);
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return new Response(`Invalid signature: ${err.message}`, { status: 400 });
  }

  const store = getStore('referrals');

  // Le compte Stripe est mutualisé entre plusieurs produits Triskell.
  // On blacklist les products connus des autres landings pour éviter
  // d'enregistrer leurs ventes comme des ventes DéliNote dans le store
  // de parrainage (bug observé 2026-05-03 sur la Suite des Héros).
  // Idéalement, le Payment Link Stripe DéliNote devrait poser
  // metadata.product = 'delinote-v1' et on ferait l'inverse (whitelist).
  const OTHER_TRISKELL_PRODUCTS = new Set([
    'suite-des-heros-v1',
    'pack-electricien-v1',
    'site-officiel-v1',
  ]);

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const product = session.metadata?.product;
      if (product && OTHER_TRISKELL_PRODUCTS.has(product)) {
        console.log(`[webhook] ignored — product="${product}" appartient à une autre landing Triskell`);
        return new Response('OK', { status: 200 });
      }
      // The custom fields are returned in `custom_fields` — find ours by key.
      const customFields = session.custom_fields || [];
      const giftRecipient = customFields.find((f) => /destinataire/i.test(f.label?.custom || ''))?.text?.value || '';
      const giftMessage = customFields.find((f) => /mot|message/i.test(f.label?.custom || ''))?.text?.value || '';

      const record = {
        id: session.id,
        created: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
        amount: session.amount_total ?? 0,
        currency: session.currency ?? 'eur',
        customerEmail: session.customer_details?.email || session.customer_email || '',
        customerName: session.customer_details?.name || '',
        refCode: (session.client_reference_id || '').toUpperCase().slice(0, 32),
        giftRecipient: giftRecipient.slice(0, 200),
        giftMessage: giftMessage.slice(0, 500),
        paymentStatus: session.payment_status || 'unknown',
        payoutStatus: 'pending',
        stripePaymentUrl: `https://dashboard.stripe.com/${event.livemode ? '' : 'test/'}payments/${session.payment_intent}`,
        eventType: event.type,
      };

      await store.setJSON(session.id, record);
      console.log(`[webhook] stored referral session=${session.id} ref=${record.refCode || '-'} amount=${record.amount}`);
    } else if (event.type === 'charge.refunded') {
      // Mark any matching session as refunded so the merchant doesn't pay
      // out commissions on a refunded sale.
      const charge = event.data.object;
      const sessions = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
      const session = sessions.data[0];
      if (session) {
        const existing = await store.get(session.id, { type: 'json' });
        if (existing) {
          existing.paymentStatus = 'refunded';
          existing.payoutStatus = 'cancelled';
          await store.setJSON(session.id, existing);
          console.log(`[webhook] marked refunded session=${session.id}`);
        }
      }
    } else {
      // Useful to keep silent in dashboards; log only at debug.
      console.log(`[webhook] ignored event type ${event.type}`);
    }
  } catch (err) {
    console.error('[webhook] processing error:', err);
    // Return 200 anyway so Stripe doesn't retry forever for our app bugs.
    // Re-thrown errors trigger Stripe's retry policy which can hammer us.
  }

  return new Response('OK', { status: 200 });
};

export const config = {
  path: '/api/stripe-webhook',
};
