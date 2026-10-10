import { createClient } from '@supabase/supabase-js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authorization = req.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!token) return res.status(401).json({ error: 'Please sign in before closing checkout.' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paddleApiKey = process.env.PADDLE_API_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey
      || process.env.PADDLE_ENVIRONMENT !== 'sandbox' || !paddleApiKey?.startsWith('pdl_sdbx_')) {
    return res.status(503).json({ error: 'Checkout is temporarily unavailable.' });
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
  const { data: pendingCheckout, error: lookupError } = await admin
    .from('billing_subscriptions')
    .select('paddle_transaction_id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .is('paddle_subscription_id', null)
    .maybeSingle();
  if (lookupError) {
    console.error('Could not find pending Paddle checkout', lookupError.code || 'unknown');
    return res.status(503).json({ error: 'Could not close the previous checkout. Please try again.' });
  }

  const transactionId = pendingCheckout?.paddle_transaction_id;
  if (typeof transactionId === 'string' && /^txn_[a-z\d]{26}$/i.test(transactionId)) {
    let response: Response;
    try {
      response = await fetch(`https://sandbox-api.paddle.com/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${paddleApiKey}`,
          'Content-Type': 'application/json',
          'Paddle-Version': '1',
        },
        body: JSON.stringify({ status: 'canceled' }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return res.status(502).json({ error: 'Paddle did not confirm cancellation. The previous checkout is still reserved; try again shortly.' });
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error('Paddle Sandbox checkout cancellation failed', response.status, payload?.error?.code || 'unknown');
      return res.status(502).json({ error: 'Paddle could not close the previous checkout. It remains reserved to protect your account.' });
    }
  }

  const { data: released, error: releaseError } = await admin.rpc('release_paddle_checkout', { p_user_id: user.id });
  if (releaseError) {
    console.error('Could not release Paddle checkout reservation', releaseError.code || 'unknown');
    return res.status(503).json({ error: 'The previous checkout was closed, but the reservation could not be cleared. Try again.' });
  }

  return res.status(200).json({ released: Boolean(released) });
}
