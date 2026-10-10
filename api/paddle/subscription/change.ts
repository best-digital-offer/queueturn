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

type PlanId = 'starter' | 'pro' | 'unlimited';
type BillingCycle = 'monthly' | 'annual';
type PriceMapping = { plan: PlanId; billingCycle: BillingCycle; env: string };

const priceMappings: PriceMapping[] = [
  { plan: 'starter', billingCycle: 'monthly', env: 'PADDLE_PRICE_STARTER_MONTHLY' },
  { plan: 'starter', billingCycle: 'annual', env: 'PADDLE_PRICE_STARTER_ANNUAL' },
  { plan: 'pro', billingCycle: 'monthly', env: 'PADDLE_PRICE_PRO_MONTHLY' },
  { plan: 'pro', billingCycle: 'annual', env: 'PADDLE_PRICE_PRO_ANNUAL' },
  { plan: 'unlimited', billingCycle: 'monthly', env: 'PADDLE_PRICE_UNLIMITED_MONTHLY' },
  { plan: 'unlimited', billingCycle: 'annual', env: 'PADDLE_PRICE_UNLIMITED_ANNUAL' },
];

const planRank: Record<PlanId, number> = { starter: 1, pro: 2, unlimited: 3 };
const isPlanId = (value: unknown): value is PlanId =>
  value === 'starter' || value === 'pro' || value === 'unlimited';
const isBillingCycle = (value: unknown): value is BillingCycle =>
  value === 'monthly' || value === 'annual';

function priceIdFor(plan: PlanId, billingCycle: BillingCycle): string | undefined {
  const mapping = priceMappings.find((candidate) => candidate.plan === plan && candidate.billingCycle === billingCycle);
  const priceId = mapping ? process.env[mapping.env] : undefined;
  return priceId && /^pri_[a-z\d]{26}$/i.test(priceId) ? priceId : undefined;
}

function summarizePreview(preview: any) {
  const immediateTotal = preview?.immediate_transaction?.details?.totals?.total ?? '0';
  const recurringTotal = preview?.recurring_transaction_details?.totals?.total;
  const currencyCode = preview?.currency_code || preview?.immediate_transaction?.currency_code || 'USD';
  return { immediateTotal: String(immediateTotal), recurringTotal: typeof recurringTotal === 'string' ? recurringTotal : null, currencyCode };
}

function paddleError(payload: any): string {
  return typeof payload?.error?.code === 'string' ? payload.error.code : 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authorization = req.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!token) return res.status(401).json({ error: 'Please sign in before changing your subscription.' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paddleApiKey = process.env.PADDLE_API_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey
      || process.env.PADDLE_ENVIRONMENT !== 'sandbox' || !paddleApiKey?.startsWith('pdl_sdbx_')) {
    return res.status(503).json({ error: 'Paddle Sandbox subscription changes are not configured.' });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Choose a valid upgrade and billing cycle.' });
  }
  const { action, plan, billingCycle, expectedImmediateTotal, expectedRecurringTotal, expectedCurrencyCode } = req.body as {
    action?: unknown;
    plan?: unknown;
    billingCycle?: unknown;
    expectedImmediateTotal?: unknown;
    expectedRecurringTotal?: unknown;
    expectedCurrencyCode?: unknown;
  };
  if ((action !== 'preview' && action !== 'apply') || !isPlanId(plan) || !isBillingCycle(billingCycle)) {
    return res.status(400).json({ error: 'Choose a valid upgrade and billing cycle.' });
  }

  const targetPriceId = priceIdFor(plan, billingCycle);
  if (!targetPriceId) return res.status(503).json({ error: `The ${plan} ${billingCycle} price is not configured.` });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: subscriptionRow, error: subscriptionLookupError } = await admin
    .from('billing_subscriptions')
    .select('plan,billing_cycle,status,paddle_subscription_id,price_id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing', 'pending'])
    .not('paddle_subscription_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subscriptionLookupError) {
    console.error('Could not load current Paddle subscription', subscriptionLookupError.code || 'unknown');
    return res.status(503).json({ error: 'Could not load your current subscription. Please try again.' });
  }
  if (!subscriptionRow || !isPlanId(subscriptionRow.plan) || !isBillingCycle(subscriptionRow.billing_cycle)
      || typeof subscriptionRow.paddle_subscription_id !== 'string') {
    return res.status(409).json({ error: 'We could not find an active Paddle subscription to upgrade.' });
  }

  const upgrading = planRank[plan] > planRank[subscriptionRow.plan];
  const changingCycle = plan === subscriptionRow.plan && billingCycle !== subscriptionRow.billing_cycle;
  if (!upgrading && !changingCycle) {
    return res.status(409).json({ error: 'Choose a higher plan or a different billing cycle.' });
  }

  let currentResponse: Response;
  try {
    currentResponse = await fetch(`https://sandbox-api.paddle.com/subscriptions/${subscriptionRow.paddle_subscription_id}`, {
      headers: { Authorization: `Bearer ${paddleApiKey}`, 'Paddle-Version': '1' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return res.status(502).json({ error: 'Paddle did not respond while loading your subscription.' });
  }
  const currentPayload = await currentResponse.json().catch(() => ({}));
  if (!currentResponse.ok) {
    console.error('Paddle Sandbox subscription lookup failed', currentResponse.status, paddleError(currentPayload));
    return res.status(502).json({ error: 'Paddle could not load your subscription. Please try again.' });
  }

  const currentSubscription = currentPayload?.data;
  if (!currentSubscription || currentSubscription.status === 'past_due') {
    return res.status(409).json({ error: 'Resolve the past-due payment before upgrading this subscription.' });
  }
  if (!['active', 'trialing'].includes(currentSubscription.status)) {
    return res.status(409).json({ error: 'Paddle is still confirming this subscription. Try again after payment confirmation.' });
  }
  if (currentSubscription.scheduled_change) {
    return res.status(409).json({ error: 'Change or remove the scheduled subscription change before upgrading.' });
  }
  if (!Array.isArray(currentSubscription.items) || currentSubscription.items.length === 0) {
    return res.status(409).json({ error: 'Paddle did not return the current subscription items.' });
  }

  const storedPriceId = typeof subscriptionRow.price_id === 'string'
    ? subscriptionRow.price_id
    : priceIdFor(subscriptionRow.plan, subscriptionRow.billing_cycle);
  const targetItem = currentSubscription.items.find((item: any) => {
    const itemPriceId = item?.price?.id || item?.price_id;
    return itemPriceId === storedPriceId;
  }) || currentSubscription.items.find((item: any) => {
    const itemPriceId = item?.price?.id || item?.price_id;
    return priceMappings.some((mapping) => process.env[mapping.env] === itemPriceId);
  });
  if (!targetItem) return res.status(409).json({ error: 'Your current plan price could not be matched to the Sandbox catalog.' });
  const currentItemPriceId = targetItem?.price?.id || targetItem?.price_id;
  const items = currentSubscription.items.map((item: any) => {
    const itemPriceId = item?.price?.id || item?.price_id;
    return {
      price_id: itemPriceId === currentItemPriceId ? targetPriceId : itemPriceId,
      quantity: item.quantity,
    };
  });
  const updateBody = {
    items,
    proration_billing_mode: 'prorated_immediately',
    on_payment_failure: 'prevent_change',
  };

  let previewResponse: Response;
  try {
    previewResponse = await fetch(`https://sandbox-api.paddle.com/subscriptions/${subscriptionRow.paddle_subscription_id}/preview`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        'Content-Type': 'application/json',
        'Paddle-Version': '1',
      },
      body: JSON.stringify(updateBody),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return res.status(502).json({ error: 'Paddle did not respond while calculating the upgrade price.' });
  }
  const previewPayload = await previewResponse.json().catch(() => ({}));
  if (!previewResponse.ok) {
    console.error('Paddle Sandbox subscription preview failed', previewResponse.status, paddleError(previewPayload));
    return res.status(502).json({ error: 'Paddle could not calculate this subscription change. Check the subscription status and try again.' });
  }

  const preview = summarizePreview(previewPayload?.data);
  if (!/^-?\d+$/.test(preview.immediateTotal)
      || (preview.recurringTotal !== null && !/^-?\d+$/.test(preview.recurringTotal))) {
    return res.status(502).json({ error: 'Paddle returned an invalid price preview.' });
  }

  if (action === 'preview') {
    return res.status(200).json({ ...preview, plan, billingCycle, priceId: targetPriceId });
  }

  if (typeof expectedImmediateTotal !== 'string' || expectedImmediateTotal !== preview.immediateTotal
      || typeof expectedRecurringTotal !== 'string' || expectedRecurringTotal !== (preview.recurringTotal || '')
      || typeof expectedCurrencyCode !== 'string' || expectedCurrencyCode !== preview.currencyCode) {
    return res.status(409).json({
      code: 'preview_changed',
      error: 'The upgrade price changed. Review the updated amount before confirming.',
      ...preview,
      plan,
      billingCycle,
      priceId: targetPriceId,
    });
  }

  let updateResponse: Response;
  try {
    updateResponse = await fetch(`https://sandbox-api.paddle.com/subscriptions/${subscriptionRow.paddle_subscription_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        'Content-Type': 'application/json',
        'Paddle-Version': '1',
      },
      body: JSON.stringify(updateBody),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return res.status(502).json({ error: 'Paddle did not respond while applying the subscription change. Refresh your billing page before retrying.' });
  }
  const updatePayload = await updateResponse.json().catch(() => ({}));
  if (!updateResponse.ok) {
    console.error('Paddle Sandbox subscription update failed', updateResponse.status, paddleError(updatePayload));
    return res.status(502).json({ error: 'Paddle could not apply the subscription change. Your existing plan remains active.' });
  }

  const applied = updatePayload?.data?.items?.some((item: any) => (item?.price?.id || item?.price_id) === targetPriceId);
  if (!applied) {
    return res.status(402).json({ error: 'Paddle did not confirm the change. Your current plan is unchanged.' });
  }

  return res.status(200).json({
    updated: true,
    plan,
    billingCycle,
    priceId: targetPriceId,
    status: updatePayload.data.status,
    immediateTotal: preview.immediateTotal,
    recurringTotal: preview.recurringTotal,
    currencyCode: preview.currencyCode,
  });
}
