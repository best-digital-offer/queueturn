import { createClient } from '@supabase/supabase-js';
import { signedSupabaseUserId } from '../checkout-signature';

type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type VercelResponse = { setHeader(name: string, value: string): void; status(code: number): VercelResponse; json(body: unknown): VercelResponse };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const authorization = req.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!token) return res.status(401).json({ error: 'Please sign in before attaching checkout.' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paddleApiKey = process.env.PADDLE_API_KEY;
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !webhookSecret
      || process.env.PADDLE_ENVIRONMENT !== 'sandbox' || !paddleApiKey?.startsWith('pdl_sdbx_')) {
    return res.status(503).json({ error: 'Paddle Sandbox checkout is not configured.' });
  }

  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
  const transactionId = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? (req.body as { transactionId?: unknown }).transactionId
    : undefined;
  if (typeof transactionId !== 'string' || !/^txn_[a-z\d]{26}$/i.test(transactionId)) {
    return res.status(400).json({ error: 'Checkout transaction is invalid.' });
  }

  let response: Response;
  try {
    response = await fetch(`https://sandbox-api.paddle.com/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${paddleApiKey}`, 'Paddle-Version': '1' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return res.status(502).json({ error: 'Paddle could not verify this checkout.' });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || signedSupabaseUserId(payload?.data?.custom_data || {}, webhookSecret) !== user.id) {
    return res.status(403).json({ error: 'This checkout does not belong to your account.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.from('billing_subscriptions')
    .update({ paddle_transaction_id: transactionId })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .is('paddle_subscription_id', null);
  if (error) {
    console.error('Could not attach Paddle checkout transaction', error.code || 'unknown');
    return res.status(503).json({ error: 'Could not save this checkout. Please try again.' });
  }
  return res.status(200).json({ attached: true });
}
