type VercelRequest = AsyncIterable<Buffer | string> & { method?: string; headers: Record<string, string | string[] | undefined> };
type VercelResponse = { setHeader(name: string, value: string): void; status(code: number): VercelResponse; json(body: unknown): VercelResponse };
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function validSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(signatureHeader.split(';').map(part => {
    const index = part.indexOf('=');
    return index > 0 ? [part.slice(0, index).trim(), part.slice(index + 1).trim()] : ['', ''];
  }).filter(([key, value]) => key && value));
  const timestamp = parts.ts;
  const received = parts.h1;
  if (!timestamp || !received || !/^\d+$/.test(timestamp)) return false;
  const signedPayload = Buffer.from(`${timestamp}:${rawBody.toString('utf8')}`);
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: 'Webhook configuration is incomplete.' });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['paddle-signature'];
  if (typeof signature !== 'string' || !validSignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid Paddle signature.' });
  }

  let event: any;
  try { event = JSON.parse(rawBody.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON payload.' }); }

  const eventId = event?.event_id;
  const eventType = event?.event_type;
  const data = event?.data;
  if (typeof eventId !== 'string' || typeof eventType !== 'string' || !data) {
    return res.status(400).json({ error: 'Missing event fields.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: eventInsertError } = await supabase.from('paddle_webhook_events').insert({ event_id: eventId, event_type: eventType });
  if (eventInsertError?.code === '23505') return res.status(200).json({ received: true, duplicate: true });
  if (eventInsertError) {
    console.error('Could not record Paddle event', eventInsertError.code);
    return res.status(500).json({ error: 'Could not record webhook event.' });
  }

  try {
    const custom = data.custom_data || {};
    const userId = custom.supabase_user_id;
    const plan = custom.plan;
    const billingCycle = custom.billing_cycle;
    const subscriptionId = data.id && String(data.id).startsWith('sub_') ? data.id : data.subscription_id;
    const transactionId = data.id && String(data.id).startsWith('txn_') ? data.id : data.transaction_id;
    const customerId = data.customer_id;
    const priceId = data.items?.[0]?.price?.id || data.items?.[0]?.price_id;
    const statusMap: Record<string, string> = {
      'subscription.created': 'active',
      'subscription.activated': 'active',
      'subscription.updated': data.status || 'active',
      'subscription.past_due': 'past_due',
      'subscription.paused': 'paused',
      'subscription.resumed': 'active',
      'subscription.canceled': 'canceled'
    };

    // A completed transaction is not, by itself, proof that a subscription is active.
    // Subscription lifecycle events are the source of truth for the subscription row.
    if (eventType.startsWith('subscription.')) {
      const resolvedUserId = userId || data.custom_data?.supabase_user_id;
      if (!resolvedUserId) {
        // Some subscription events omit custom_data; update an existing row by subscription ID.
        if (subscriptionId) {
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (statusMap[eventType]) patch.status = statusMap[eventType];
          if (eventType === 'subscription.canceled') patch.canceled_at = data.canceled_at || new Date().toISOString();
          const { error } = await supabase.from('billing_subscriptions').update(patch).eq('paddle_subscription_id', subscriptionId);
          if (error) throw error;
        }
      } else if (plan && ['starter', 'pro', 'unlimited'].includes(plan) && billingCycle && ['monthly', 'annual'].includes(billingCycle)) {
        const row = {
          user_id: resolvedUserId,
          plan,
          billing_cycle: billingCycle,
          status: statusMap[eventType] || data.status || 'pending',
          paddle_customer_id: customerId || null,
          paddle_subscription_id: subscriptionId || null,
          paddle_transaction_id: transactionId || null,
          price_id: priceId || null,
          current_period_start: data.current_billing_period?.starts_at || null,
          current_period_end: data.current_billing_period?.ends_at || null,
          cancel_at_period_end: Boolean(data.scheduled_change?.action === 'cancel'),
          canceled_at: data.canceled_at || null,
          updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('billing_subscriptions').upsert(row, { onConflict: 'paddle_subscription_id' });
        if (error) throw error;
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    // Allow Paddle to retry: remove the idempotency row if processing did not complete.
    await supabase.from('paddle_webhook_events').delete().eq('event_id', eventId);
    console.error('Paddle webhook processing failed', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'Webhook processing failed; Paddle may retry.' });
  }
}
