import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
};

const priceMap: Record<string, string> = {
  'starter:monthly': 'PADDLE_PRICE_STARTER_MONTHLY',
  'starter:annual': 'PADDLE_PRICE_STARTER_ANNUAL',
  'pro:monthly': 'PADDLE_PRICE_PRO_MONTHLY',
  'pro:annual': 'PADDLE_PRICE_PRO_ANNUAL',
  'unlimited:monthly': 'PADDLE_PRICE_UNLIMITED_MONTHLY',
  'unlimited:annual': 'PADDLE_PRICE_UNLIMITED_ANNUAL',
};

const isPaidPlan = (value: unknown): value is 'starter' | 'pro' | 'unlimited' =>
  value === 'starter' || value === 'pro' || value === 'unlimited';
const isBillingCycle = (value: unknown): value is 'monthly' | 'annual' =>
  value === 'monthly' || value === 'annual';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authorization = req.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!token) return res.status(401).json({ error: 'Please sign in before starting checkout.' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(503).json({ error: 'Authentication or billing is temporarily unavailable.' });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Choose a valid paid plan and billing cycle.' });
  }
  const { plan, billingCycle } = req.body as { plan?: unknown; billingCycle?: unknown };
  if (!isPaidPlan(plan) || !isBillingCycle(billingCycle)) {
    return res.status(400).json({ error: 'Choose a valid paid plan and billing cycle.' });
  }

  const priceVariable = priceMap[`${plan}:${billingCycle}`];
  const priceId = priceVariable ? process.env[priceVariable] : undefined;
  if (!priceId || !/^pri_[a-z\d]{26}$/i.test(priceId)) {
    return res.status(503).json({ error: `The ${plan} ${billingCycle} price is not configured.` });
  }

  // This project is intentionally Sandbox-only. Fail closed if its configuration drifts.
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (process.env.PADDLE_ENVIRONMENT !== 'sandbox'
      || !process.env.VITE_PADDLE_CLIENT_TOKEN?.startsWith('test_')
      || !webhookSecret) {
    return res.status(503).json({ error: 'Paddle Sandbox billing is not configured.' });
  }

  const reservation = await admin.rpc('reserve_paddle_checkout', {
    p_user_id: user.id,
    p_plan: plan,
    p_billing_cycle: billingCycle,
  });
  if (reservation.error) {
    console.error('Could not reserve Paddle checkout', reservation.error.code || 'unknown');
    return res.status(503).json({ error: 'Checkout is temporarily unavailable. Please try again.' });
  }
  const reservationResult = Array.isArray(reservation.data) ? reservation.data[0] : reservation.data;
  if (!reservationResult?.reserved) {
    const reason = reservationResult?.reason;
    if (reason === 'active_subscription') {
      return res.status(409).json({ error: 'Your account already has a subscription. Manage it before starting another checkout.' });
    }
    if (reason === 'checkout_in_progress') {
      return res.status(409).json({
        code: 'checkout_in_progress',
        error: 'A checkout is already in progress for your account. Close the previous checkout to choose another plan.',
      });
    }
    return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
  }

  // The identity and selected tier travel to Paddle as signed custom data. The
  // webhook verifies this signature before it associates a subscription with a user.
  const issuedAt = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', webhookSecret)
    .update(`${user.id}:${plan}:${billingCycle}:${issuedAt}`)
    .digest('hex');
  return res.status(200).json({
    priceId,
    plan,
    billingCycle,
    email: user.email || null,
    customData: {
      supabase_user_id: user.id,
      plan,
      billing_cycle: billingCycle,
      checkout_issued_at: issuedAt,
      checkout_signature: signature,
    },
  });
}
