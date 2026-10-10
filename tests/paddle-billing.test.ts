import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.PADDLE_ENVIRONMENT = 'sandbox';
process.env.VITE_PADDLE_CLIENT_TOKEN = 'test_client_token_for_unit_tests';
process.env.PADDLE_API_KEY = 'pdl_sdbx_apikey_test';
process.env.PADDLE_WEBHOOK_SECRET = 'test-notification-secret';
process.env.PADDLE_PRICE_STARTER_MONTHLY = 'pri_01m4j58xsfkp7bh4n9sdr53vja';
process.env.PADDLE_PRICE_STARTER_ANNUAL = 'pri_01m4j58y3k8pvbbmjwk9kh11ee';
process.env.PADDLE_PRICE_PRO_MONTHLY = 'pri_01m4j58yp31gc7cgcsw55y2rd8';
process.env.PADDLE_PRICE_PRO_ANNUAL = 'pri_01m4j58yyhasjnr15bkan1dzpg';
process.env.PADDLE_PRICE_UNLIMITED_MONTHLY = 'pri_01m4j58zg5krvmwztbgmwys81w';
process.env.PADDLE_PRICE_UNLIMITED_ANNUAL = 'pri_01m4j58zsegkt8d3p7aewkv4n2';

const nativeFetch = globalThis.fetch;
let mockFetch: typeof fetch;
let checkoutHandler: (req: any, res: any) => Promise<unknown>;
let webhookHandler: (req: any, res: any) => Promise<unknown>;
let requests: Array<{ url: string; method: string; headers: Headers; body: string }> = [];
let reservationResponse: unknown = [{ reserved: true, reason: null }];
let duplicateEvent = false;
let failSubscriptionSync = false;
let createdTransaction = 0;

before(async () => {
  ({ default: checkoutHandler } = await import('../api/paddle/checkout.ts'));
  ({ default: webhookHandler } = await import('../api/paddle/webhook.ts'));
});

after(() => { globalThis.fetch = nativeFetch; });

beforeEach(() => {
  requests = [];
  reservationResponse = [{ reserved: true, reason: null }];
  duplicateEvent = false;
  failSubscriptionSync = false;
  createdTransaction = 0;

  mockFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({ url, method, headers, body });

    if (url.endsWith('/auth/v1/user')) {
      if (headers.get('authorization') === 'Bearer invalid-token') {
        return new Response(JSON.stringify({ message: 'invalid token' }), { status: 401 });
      }
      return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'buyer@example.test' }), { status: 200 });
    }
    if (url.includes('/rest/v1/rpc/reserve_paddle_checkout')) {
      return new Response(JSON.stringify(reservationResponse), { status: 200 });
    }
    if (url.includes('/rest/v1/billing_subscriptions?')) {
      return new Response(JSON.stringify([{ user_id: '00000000-0000-4000-8000-000000000001' }]), { status: 200 });
    }
    if (url.includes('/rest/v1/rpc/release_paddle_checkout')) {
      return new Response('true', { status: 200 });
    }
    if (url.includes('/rest/v1/paddle_webhook_events')) {
      if (method === 'POST' && duplicateEvent) {
        return new Response(JSON.stringify({ code: '23505', message: 'duplicate key' }), { status: 409 });
      }
      return new Response(null, { status: 201 });
    }
    if (url.includes('/rest/v1/rpc/sync_paddle_subscription_event')) {
      if (failSubscriptionSync) return new Response(JSON.stringify({ message: 'database unavailable' }), { status: 500 });
      return new Response('true', { status: 200 });
    }
    if (url === 'https://sandbox-api.paddle.com/transactions') {
      createdTransaction += 1;
      return new Response(JSON.stringify({
        data: { id: 'txn_01m4j58xh2w3meny8cfdeesn10', checkout: { url: 'https://checkout.paddle.test/pay' } },
      }), { status: 201 });
    }
    throw new Error(`Unexpected network request: ${method} ${url}`);
  }) as typeof fetch;
  globalThis.fetch = mockFetch;
});

function makeResponse() {
  return {
    code: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

function makeWebhook(event: Record<string, unknown>, timestamp = Math.floor(Date.now() / 1000), signatureOverride?: string) {
  const raw = Buffer.from(JSON.stringify(event));
  const digest = createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET!).update(`${timestamp}:${raw.toString('utf8')}`).digest('hex');
  const signature = signatureOverride || `ts=${timestamp};h1=${digest}`;
  const req = {
    method: 'POST',
    headers: { 'paddle-signature': signature },
    async *[Symbol.asyncIterator]() { yield raw; },
  };
  return { req, raw };
}

function signedCustomData() {
  const userId = '00000000-0000-4000-8000-000000000001';
  const plan = 'starter';
  const billingCycle = 'monthly';
  const issuedAt = String(Math.floor(Date.now() / 1000));
  const checkoutSignature = createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET!)
    .update(`${userId}:${plan}:${billingCycle}:${issuedAt}`)
    .digest('hex');
  return { supabase_user_id: userId, plan, billing_cycle: billingCycle, checkout_issued_at: issuedAt, checkout_signature: checkoutSignature };
}

function subscriptionEvent(eventType: string, extraData: Record<string, unknown> = {}) {
  return {
    event_id: 'evt_01m4j58xh2w3meny8cfdeesn10',
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    data: {
      id: 'sub_01m4j58xh2w3meny8cfdeesn10',
      customer_id: 'ctm_01m4j58xh2w3meny8cfdeesn10',
      status: 'active',
      items: [{ price_id: process.env.PADDLE_PRICE_STARTER_MONTHLY }],
      custom_data: signedCustomData(),
      ...extraData,
    },
  };
}

test('checkout rejects unauthenticated requests without calling Paddle', async () => {
  const res = makeResponse();
  await checkoutHandler({ method: 'POST', headers: {}, body: { plan: 'starter', billingCycle: 'monthly' } }, res);
  assert.equal(res.code, 401);
  assert.equal(createdTransaction, 0);
});

test('checkout validates plan and billing cycle after authenticating the user', async () => {
  const res = makeResponse();
  await checkoutHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { plan: 'free', billingCycle: 'monthly' } }, res);
  assert.equal(res.code, 400);
  assert.equal(createdTransaction, 0);
});

test('checkout returns a safe configuration error when a price ID is missing', async () => {
  const original = process.env.PADDLE_PRICE_UNLIMITED_ANNUAL;
  process.env.PADDLE_PRICE_UNLIMITED_ANNUAL = '';
  const res = makeResponse();
  try {
    await checkoutHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { plan: 'unlimited', billingCycle: 'annual' } }, res);
  } finally {
    process.env.PADDLE_PRICE_UNLIMITED_ANNUAL = original;
  }
  assert.equal(res.code, 503);
  assert.match(JSON.stringify(res.body), /not configured/);
  assert.equal(createdTransaction, 0);
});

test('checkout fails closed if Paddle environment is not Sandbox', async () => {
  process.env.PADDLE_ENVIRONMENT = 'live';
  const res = makeResponse();
  await checkoutHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { plan: 'starter', billingCycle: 'monthly' } }, res);
  process.env.PADDLE_ENVIRONMENT = 'sandbox';
  assert.equal(res.code, 503);
  assert.equal(createdTransaction, 0);
});

test('checkout blocks active subscriptions and repeated pending checkout attempts', async (t) => {
  await t.test('active subscription', async () => {
    reservationResponse = [{ reserved: false, reason: 'active_subscription' }];
    const res = makeResponse();
    await checkoutHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { plan: 'starter', billingCycle: 'monthly' } }, res);
    assert.equal(res.code, 409);
    assert.equal(createdTransaction, 0);
  });
  await t.test('pending checkout', async () => {
    reservationResponse = [{ reserved: false, reason: 'checkout_in_progress' }];
    const res = makeResponse();
    await checkoutHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { plan: 'starter', billingCycle: 'monthly' } }, res);
    assert.equal(res.code, 409);
    assert.equal(createdTransaction, 0);
  });
});

test('authenticated checkout returns the exact Sandbox price and signed account data for all six plan cycles', async () => {
  const cases = [
    ['starter', 'monthly', 'PADDLE_PRICE_STARTER_MONTHLY'],
    ['starter', 'annual', 'PADDLE_PRICE_STARTER_ANNUAL'],
    ['pro', 'monthly', 'PADDLE_PRICE_PRO_MONTHLY'],
    ['pro', 'annual', 'PADDLE_PRICE_PRO_ANNUAL'],
    ['unlimited', 'monthly', 'PADDLE_PRICE_UNLIMITED_MONTHLY'],
    ['unlimited', 'annual', 'PADDLE_PRICE_UNLIMITED_ANNUAL'],
  ] as const;
  for (const [plan, billingCycle, priceVariable] of cases) {
    const res = makeResponse();
    await checkoutHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { plan, billingCycle } }, res);
    assert.equal(res.code, 200, `${plan} ${billingCycle}`);
    assert.equal((res.body as any).priceId, process.env[priceVariable]);
    assert.equal((res.body as any).email, 'buyer@example.test');
    assert.equal((res.body as any).customData.supabase_user_id, '00000000-0000-4000-8000-000000000001');
    assert.equal((res.body as any).customData.plan, plan);
    assert.equal((res.body as any).customData.billing_cycle, billingCycle);
    assert.match((res.body as any).customData.checkout_signature, /^[a-f\d]{64}$/i);
    assert.ok(!JSON.stringify(res.body).includes(process.env.PADDLE_API_KEY!));
  }
  assert.equal(requests.filter((request) => request.url.startsWith('https://sandbox-api.paddle.com/')).length, 0);
  const reservationRequest = requests.find(request => request.url.includes('/rest/v1/rpc/reserve_paddle_checkout'));
  assert.equal(reservationRequest?.headers.get('authorization'), `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
});

test('invalid and stale webhook signatures are rejected before database writes', async (t) => {
  await t.test('invalid signature', async () => {
    const { req } = makeWebhook(subscriptionEvent('subscription.activated'), undefined, 'ts=1;h1=bad');
    const res = makeResponse();
    await webhookHandler(req, res);
    assert.equal(res.code, 401);
    assert.equal(requests.filter(r => r.url.includes('/rest/v1/')).length, 0);
  });
  await t.test('stale timestamp', async () => {
    const { req } = makeWebhook(subscriptionEvent('subscription.activated'), Math.floor(Date.now() / 1000) - 10);
    const res = makeResponse();
    await webhookHandler(req, res);
    assert.equal(res.code, 401);
    assert.equal(requests.filter(r => r.url.includes('/rest/v1/')).length, 0);
  });
});

test('duplicate webhook event IDs are acknowledged without processing again', async () => {
  duplicateEvent = true;
  const { req } = makeWebhook(subscriptionEvent('subscription.activated'));
  const res = makeResponse();
  await webhookHandler(req, res);
  assert.equal(res.code, 200);
  assert.equal((res.body as any).duplicate, true);
  assert.equal(requests.filter(r => r.url.includes('sync_paddle_subscription_event')).length, 0);
});

test('transaction.completed records metadata without activating a subscription', async () => {
  const { req } = makeWebhook(subscriptionEvent('transaction.completed', {
    id: 'txn_01m4j58xh2w3meny8cfdeesn10',
    subscription_id: 'sub_01m4j58xh2w3meny8cfdeesn10',
  }));
  const res = makeResponse();
  await webhookHandler(req, res);
  assert.equal(res.code, 200);
  const syncRequest = requests.find(r => r.url.includes('sync_paddle_subscription_event'));
  assert.ok(syncRequest);
  assert.equal(JSON.parse(syncRequest.body).p_status, null);
});

test('subscription activation is synchronized and failed processing remains retryable', async (t) => {
  await t.test('activation', async () => {
    const { req } = makeWebhook(subscriptionEvent('subscription.activated'));
    const res = makeResponse();
    await webhookHandler(req, res);
    assert.equal(res.code, 200);
    const syncRequest = requests.find(r => r.url.includes('sync_paddle_subscription_event'));
    assert.equal(JSON.parse(syncRequest!.body).p_status, 'active');
  });
  await t.test('failed database sync', async () => {
    failSubscriptionSync = true;
    const { req } = makeWebhook(subscriptionEvent('subscription.updated'));
    const res = makeResponse();
    await webhookHandler(req, res);
    assert.equal(res.code, 500);
    assert.ok(requests.some(r => r.url.includes('/rest/v1/paddle_webhook_events') && r.method === 'DELETE'));
  });
});

test('existing Paddle subscription events resolve the account from the stored subscription ID', async () => {
  const event = subscriptionEvent('subscription.updated', {
    custom_data: { supabase_user_id: '00000000-0000-4000-8000-000000000099', plan: 'starter', billing_cycle: 'monthly' },
    items: [{ price_id: process.env.PADDLE_PRICE_PRO_ANNUAL }],
  });
  const { req } = makeWebhook(event);
  const res = makeResponse();
  await webhookHandler(req, res);
  assert.equal(res.code, 200);
  const syncRequest = requests.find((request) => request.url.includes('sync_paddle_subscription_event'));
  const body = JSON.parse(syncRequest!.body);
  assert.equal(body.p_user_id, '00000000-0000-4000-8000-000000000001');
  assert.equal(body.p_plan, 'pro');
  assert.equal(body.p_billing_cycle, 'annual');
});

test('subscription lifecycle events map canceled, past-due, paused, and resumed states', async () => {
  const cases = [
    ['subscription.canceled', 'canceled'],
    ['subscription.past_due', 'past_due'],
    ['subscription.paused', 'paused'],
    ['subscription.resumed', 'active'],
  ] as const;
  for (const [eventType, expectedStatus] of cases) {
    const { req } = makeWebhook(subscriptionEvent(eventType));
    const res = makeResponse();
    await webhookHandler(req, res);
    const syncRequest = requests.filter(r => r.url.includes('sync_paddle_subscription_event')).at(-1);
    assert.equal(res.code, 200, eventType);
    assert.equal(JSON.parse(syncRequest!.body).p_status, expectedStatus, eventType);
  }
});
