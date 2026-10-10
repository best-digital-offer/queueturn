import { createClient } from '@supabase/supabase-js';

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
  const paddleApiKey = process.env.PADDLE_API_KEY;
  if (process.env.PADDLE_ENVIRONMENT !== 'sandbox' || !paddleApiKey?.startsWith('pdl_sdbx_')) {
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

  const origin = process.env.APP_BASE_URL || 'https://www.queueturn.com';
  let response: Response;
  try {
    response = await fetch('https://sandbox-api.paddle.com/transactions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        'Content-Type': 'application/json',
        'Paddle-Version': '1',
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        collection_mode: 'automatic',
        checkout: { url: origin },
        custom_data: { supabase_user_id: user.id, plan, billing_cycle: billingCycle },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // The remote create may have succeeded despite a timeout; keep the reservation
    // briefly so an immediate retry cannot create another draft transaction.
    console.error('Paddle Sandbox transaction request failed before a response was received.');
    return res.status(502).json({ error: 'Paddle did not respond. Please wait up to 30 minutes before trying checkout again.' });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Paddle Sandbox transaction creation failed', response.status, payload?.error?.code || 'unknown');
    const { error: releaseError } = await admin.rpc('release_paddle_checkout', { p_user_id: user.id });
    if (releaseError) console.error('Could not release failed checkout reservation', releaseError.code || 'unknown');
    return res.status(502).json({ error: 'Paddle could not create checkout. Verify the Sandbox configuration and try again.' });
  }

  const checkoutUrl = payload?.data?.checkout?.url;
  const transactionId = payload?.data?.id;
  if (typeof checkoutUrl !== 'string' || typeof transactionId !== 'string' || !transactionId.startsWith('txn_')) {
    // The transaction may exist; keep the reservation to prevent creating a second one immediately.
    return res.status(502).json({ error: 'Paddle did not return a usable checkout. Please wait up to 30 minutes before trying again.' });
  }

  const { error: transactionSaveError } = await admin
    .from('billing_subscriptions')
    .update({ paddle_transaction_id: transactionId })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .is('paddle_subscription_id', null);
  if (transactionSaveError) {
    console.error('Could not save Paddle checkout transaction', transactionSaveError.code || 'unknown');
    return res.status(503).json({ error: 'Checkout could not be saved. Please close it and try again.' });
  }

  return res.status(200).json({ checkoutUrl, transactionId });
}
