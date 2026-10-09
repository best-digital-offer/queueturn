type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type VercelResponse = { setHeader(name: string, value: string): void; status(code: number): VercelResponse; json(body: unknown): VercelResponse };
import { createClient } from '@supabase/supabase-js';

const priceMap: Record<string, string | undefined> = {
  'starter:monthly': process.env.PADDLE_PRICE_STARTER_MONTHLY,
  'starter:annual': process.env.PADDLE_PRICE_STARTER_ANNUAL,
  'pro:monthly': process.env.PADDLE_PRICE_PRO_MONTHLY,
  'pro:annual': process.env.PADDLE_PRICE_PRO_ANNUAL,
  'unlimited:monthly': process.env.PADDLE_PRICE_UNLIMITED_MONTHLY,
  'unlimited:annual': process.env.PADDLE_PRICE_UNLIMITED_ANNUAL,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const paddleApiKey = process.env.PADDLE_API_KEY;
  if (!token || !supabaseUrl || !anonKey || !paddleApiKey) {
    return res.status(401).json({ error: 'Authentication or billing configuration is missing.' });
  }

  const { plan, billingCycle } = (req.body || {}) as { plan?: string; billingCycle?: string };
  if (!plan || !['starter', 'pro', 'unlimited'].includes(plan) || !billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
    return res.status(400).json({ error: 'Choose a valid paid plan and billing cycle.' });
  }
  const priceId = priceMap[`${plan}:${billingCycle}`];
  if (!priceId || !priceId.startsWith('pri_')) {
    return res.status(503).json({ error: `Paddle price ID for ${plan} ${billingCycle} is not configured yet.` });
  }

  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });

  const isSandbox = (process.env.PADDLE_ENVIRONMENT || 'sandbox') !== 'live';
  const apiBase = isSandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
  const origin = process.env.APP_BASE_URL || 'https://www.queueturn.com';
  const response = await fetch(`${apiBase}/transactions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${paddleApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: 'automatic',
      checkout: { url: origin },
      custom_data: { supabase_user_id: user.id, plan, billing_cycle: billingCycle }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Paddle transaction creation failed', response.status, payload?.error?.code || payload?.error?.type || 'unknown');
    return res.status(502).json({ error: 'Paddle could not create checkout. Verify Sandbox API key and price IDs.' });
  }
  const checkoutUrl = payload?.data?.checkout?.url;
  if (!checkoutUrl || typeof checkoutUrl !== 'string') {
    return res.status(502).json({ error: 'Paddle did not return a checkout URL for this transaction.' });
  }
  return res.status(200).json({ checkoutUrl, transactionId: payload?.data?.id });
}
