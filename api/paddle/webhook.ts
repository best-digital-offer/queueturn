import type { IncomingHttpHeaders } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { signedSupabaseUserId } from './checkout-signature';

type VercelRequest = AsyncIterable<Buffer | string> & {
  method?: string;
  headers: IncomingHttpHeaders & Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
};

export const config = { api: { bodyParser: false } };

const SIGNATURE_TOLERANCE_SECONDS = 5;
const subscriptionEvents = new Set([
  'subscription.created',
  'subscription.activated',
  'subscription.trialing',
  'subscription.updated',
  'subscription.past_due',
  'subscription.paused',
  'subscription.resumed',
  'subscription.canceled',
]);

const priceMappings = [
  { plan: 'starter', billingCycle: 'monthly', env: 'PADDLE_PRICE_STARTER_MONTHLY' },
  { plan: 'starter', billingCycle: 'annual', env: 'PADDLE_PRICE_STARTER_ANNUAL' },
  { plan: 'pro', billingCycle: 'monthly', env: 'PADDLE_PRICE_PRO_MONTHLY' },
  { plan: 'pro', billingCycle: 'annual', env: 'PADDLE_PRICE_PRO_ANNUAL' },
  { plan: 'unlimited', billingCycle: 'monthly', env: 'PADDLE_PRICE_UNLIMITED_MONTHLY' },
  { plan: 'unlimited', billingCycle: 'annual', env: 'PADDLE_PRICE_UNLIMITED_ANNUAL' },
];

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function validSignature(rawBody: Buffer, signatureHeader: string, secret: string, nowSeconds: number): boolean {
  const parts = Object.fromEntries(signatureHeader.split(';').map(part => {
    const index = part.indexOf('=');
    return index > 0 ? [part.slice(0, index).trim(), part.slice(index + 1).trim()] : ['', ''];
  }).filter(([key, value]) => key && value));
  const timestamp = parts.ts;
  const received = parts.h1;
  if (!timestamp || !received || !/^\d+$/.test(timestamp) || !/^[a-f\d]{64}$/i.test(received)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}:${rawBody.toString('utf8')}`)
    .digest();
  const provided = Buffer.from(received, 'hex');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function validStatus(status: unknown): string | null {
  return typeof status === 'string'
    && ['pending', 'trialing', 'active', 'past_due', 'paused', 'canceled'].includes(status)
    ? status
    : null;
}

function statusForEvent(eventType: string, paddleStatus: unknown): string | null {
  switch (eventType) {
    case 'transaction.payment_failed':
    case 'transaction.past_due': return 'past_due';
    case 'subscription.activated': return 'active';
    case 'subscription.trialing': return 'trialing';
    case 'subscription.past_due': return 'past_due';
    case 'subscription.paused': return 'paused';
    case 'subscription.resumed': return 'active';
    case 'subscription.canceled': return 'canceled';
    case 'subscription.created':
    case 'subscription.updated':
      return validStatus(paddleStatus);
    default:
      return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: 'Webhook configuration is incomplete.' });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['paddle-signature'];
  if (typeof signature !== 'string' || !validSignature(rawBody, signature, secret, Math.floor(Date.now() / 1000))) {
    return res.status(401).json({ error: 'Invalid Paddle signature.' });
  }

  let event: any;
  try { event = JSON.parse(rawBody.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON payload.' }); }

  const eventId = event?.event_id;
  const eventType = event?.event_type;
  const occurredAt = event?.occurred_at;
  const occurredAtMs = typeof occurredAt === 'string' ? Date.parse(occurredAt) : NaN;
  const data = event?.data;
  if (typeof eventId !== 'string' || typeof eventType !== 'string' || !data
      || !Number.isFinite(occurredAtMs)) {
    return res.status(400).json({ error: 'Missing or invalid Paddle event fields.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: eventInsertError } = await supabase
    .from('paddle_webhook_events')
    .insert({ event_id: eventId, event_type: eventType });
  if (eventInsertError?.code === '23505') return res.status(200).json({ received: true, duplicate: true });
  if (eventInsertError) {
    console.error('Could not record Paddle event', eventInsertError.code || 'unknown');
    return res.status(500).json({ error: 'Could not record webhook event.' });
  }

  try {
    const custom = data.custom_data && typeof data.custom_data === 'object' ? data.custom_data : {};
    const customPlan = ['starter', 'pro', 'unlimited'].includes(custom.plan) ? custom.plan : null;
    const customBillingCycle = ['monthly', 'annual'].includes(custom.billing_cycle) ? custom.billing_cycle : null;
    const id = typeof data.id === 'string' ? data.id : '';
    const subscriptionId = id.startsWith('sub_') ? id : data.subscription_id;
    const transactionId = id.startsWith('txn_') ? id : data.transaction_id;
    const customerId = typeof data.customer_id === 'string' ? data.customer_id : null;
    const items = Array.isArray(data.items) ? data.items : [];
    const mappedPlanItem = items.find((item: any) => {
      const itemPriceId = item?.price?.id || item?.price_id;
      return priceMappings.some(mapping => process.env[mapping.env] === itemPriceId);
    });
    const priceId = mappedPlanItem?.price?.id || mappedPlanItem?.price_id
      || items[0]?.price?.id || items[0]?.price_id || null;
    const mappedPrice = priceMappings.find(mapping => process.env[mapping.env] === priceId);
    const plan = mappedPrice?.plan || customPlan;
    const billingCycle = mappedPrice?.billingCycle || customBillingCycle;
    const eventStatus = statusForEvent(eventType, data.status);
    let userId = signedSupabaseUserId(custom, secret);

    // Older subscriptions may predate signed checkout metadata. A matching
    // Paddle subscription ID already stored in our database is authoritative.
    if (!userId && typeof subscriptionId === 'string' && subscriptionId.startsWith('sub_')) {
      const { data: knownSubscription, error: knownSubscriptionError } = await supabase
        .from('billing_subscriptions')
        .select('user_id')
        .eq('paddle_subscription_id', subscriptionId)
        .maybeSingle();
      if (knownSubscriptionError) throw knownSubscriptionError;
      userId = typeof knownSubscription?.user_id === 'string' ? knownSubscription.user_id : null;
    }

    // Complete a checkout created by the previous transaction-based flow only
    // when its Paddle transaction ID matches a server-owned pending reservation.
    if (!userId && typeof transactionId === 'string' && transactionId.startsWith('txn_')) {
      const { data: pendingCheckout, error: pendingCheckoutError } = await supabase
        .from('billing_subscriptions')
        .select('user_id')
        .eq('paddle_transaction_id', transactionId)
        .eq('status', 'pending')
        .is('paddle_subscription_id', null)
        .maybeSingle();
      if (pendingCheckoutError) throw pendingCheckoutError;
      userId = typeof pendingCheckout?.user_id === 'string' ? pendingCheckout.user_id : null;
    }

    // Transaction completion can create a pending subscription record and enrich
    // metadata, but it never grants access. Subscription lifecycle events do that.
    if (subscriptionEvents.has(eventType) || eventType === 'transaction.completed'
        || eventType === 'transaction.payment_failed' || eventType === 'transaction.past_due') {
      if (typeof subscriptionId === 'string' && subscriptionId.startsWith('sub_')) {
        const { error } = await supabase.rpc('sync_paddle_subscription_event', {
          p_user_id: userId,
          p_plan: plan,
          p_billing_cycle: billingCycle,
          p_status: eventStatus,
          p_paddle_customer_id: customerId,
          p_paddle_subscription_id: subscriptionId,
          p_paddle_transaction_id: typeof transactionId === 'string' && transactionId.startsWith('txn_') ? transactionId : null,
          p_price_id: typeof priceId === 'string' && priceId.startsWith('pri_') ? priceId : null,
          p_current_period_start: data.current_billing_period?.starts_at || null,
          p_current_period_end: data.current_billing_period?.ends_at || null,
          p_cancel_at_period_end: data.scheduled_change
            ? data.scheduled_change.action === 'cancel'
            : null,
          p_canceled_at: data.canceled_at || null,
          p_event_occurred_at: new Date(occurredAtMs).toISOString(),
          p_event_id: eventId,
        });
        if (error) throw error;
      } else if (subscriptionEvents.has(eventType)) {
        throw new Error('Subscription event is missing its subscription ID.');
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    // Remove the idempotency row when processing failed so Paddle's retry can run.
    await supabase.from('paddle_webhook_events').delete().eq('event_id', eventId);
    console.error('Paddle webhook processing failed', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'Webhook processing failed; Paddle may retry.' });
  }
}
