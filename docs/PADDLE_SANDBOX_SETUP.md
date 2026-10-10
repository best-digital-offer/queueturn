# QueueTurn Paddle Sandbox setup

QueueTurn billing is intentionally restricted to Paddle Sandbox. The checkout endpoint fails closed unless `PADDLE_ENVIRONMENT=sandbox` and `PADDLE_API_KEY` is a Sandbox key. Do not set Live credentials or use these Sandbox price IDs in production billing.

## 1. Create the Sandbox catalog

In the Paddle Sandbox vendor dashboard, create recurring prices in USD for the six combinations below. Use the intended QueueTurn amounts:

| Plan | Billing interval | Amount |
|---|---|---:|
| Plan | Billing interval | Amount | Environment variable | Sandbox price ID |
|---|---|---:|---|---|
| Starter | Monthly | $19 | `PADDLE_PRICE_STARTER_MONTHLY` | `pri_01m4j58xsfkp7bh4n9sdr53vja` |
| Starter | Annual | $182 | `PADDLE_PRICE_STARTER_ANNUAL` | `pri_01m4j58y3k8pvbbmjwk9kh11ee` |
| Pro | Monthly | $35 | `PADDLE_PRICE_PRO_MONTHLY` | `pri_01m4j58yp31gc7cgcsw55y2rd8` |
| Pro | Annual | $336 | `PADDLE_PRICE_PRO_ANNUAL` | `pri_01m4j58yyhasjnr15bkan1dzpg` |
| Unlimited | Monthly | $50 | `PADDLE_PRICE_UNLIMITED_MONTHLY` | `pri_01m4j58zg5krvmwztbgmwys81w` |
| Unlimited | Annual | $480 | `PADDLE_PRICE_UNLIMITED_ANNUAL` | `pri_01m4j58zsegkt8d3p7aewkv4n2` |

Copy each Paddle **price ID** (starts with `pri_`) into the matching Vercel environment variable. Do not put Paddle API keys or webhook secrets in client-side variables prefixed with `VITE_`.

## 2. Configure Vercel environment variables

Set these variables for the QueueTurn project. Use Sandbox values in Preview/Development until tests pass:

- `PADDLE_ENVIRONMENT=sandbox`
- `PADDLE_API_KEY`: Sandbox API key (server-side only)
- `PADDLE_WEBHOOK_SECRET`: secret from the Paddle notification destination
- `PADDLE_PRICE_STARTER_MONTHLY`
- `PADDLE_PRICE_STARTER_ANNUAL`
- `PADDLE_PRICE_PRO_MONTHLY`
- `PADDLE_PRICE_PRO_ANNUAL`
- `PADDLE_PRICE_UNLIMITED_MONTHLY`
- `PADDLE_PRICE_UNLIMITED_ANNUAL`
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`: server-side only; never expose in a browser bundle
- `APP_BASE_URL=https://www.queueturn.com` (use the preview URL for isolated preview tests)

## 3. Add the Paddle webhook destination

Configure a Sandbox notification destination to POST to:

`https://www.queueturn.com/api/paddle/webhook`

Subscribe to at least these events:

- `subscription.created`
- `subscription.activated`
- `subscription.trialing`
- `subscription.updated`
- `subscription.past_due`
- `subscription.paused`
- `subscription.resumed`
- `subscription.canceled`
- `transaction.completed`
- `transaction.payment_failed`

Copy the Sandbox destination's signing secret to the server-only `PADDLE_WEBHOOK_SECRET`. The webhook endpoint validates `Paddle-Signature` over the raw request body, enforces Paddle's five-second timestamp tolerance, rejects invalid signatures, deduplicates event IDs, and uses `occurred_at` plus event ID to ignore stale subscription updates. `transaction.completed` records a pending subscription when needed but never grants access by itself.

## 4. Acceptance tests

- Signed-in user can request checkout for each paid plan and cycle.
- Missing price IDs return a clear configuration error, without creating a transaction.
- Unauthenticated requests are rejected.
- Successful Sandbox checkout creates a Paddle transaction.
- Valid subscription webhooks create/update the corresponding Supabase subscription record.
- Invalid signatures are rejected with HTTP 401.
- Duplicate event IDs are acknowledged without processing twice.
- Failed checkout never activates a subscription.
- Cancelled or past-due subscriptions update status correctly.
- The subscription record is associated with the authenticated Supabase user, not a user ID supplied by an unauthenticated browser.

## Important implementation status

- `api/paddle/checkout.ts`: authenticated, Sandbox-only transaction creation, server-side price selection, and a per-user checkout reservation.
- `api/paddle/webhook.ts`: raw-body signature verification, event de-duplication, timestamp tolerance, event ordering, and subscription synchronization.
- Supabase migrations `add_paddle_subscription_billing`, `harden_paddle_billing`, and `secure_paddle_billing_rpcs`: subscription/event tables, checkout reservation, ordering fields, and service-role-only invoker RPCs.
- `BillingTab.tsx`: paid plan buttons call the checkout endpoint.

Run the repository checks with `npm run lint`, `npm test`, and `npm run build`. The Paddle handler tests mock Supabase and Paddle HTTP requests; they do not replace a real Sandbox checkout using a signed-in test account and an active notification destination.

Checkout reservations expire after thirty minutes if Paddle never confirms a subscription. Paddle does not accept client-supplied idempotency keys for arbitrary operations, so this application reservation prevents rapid repeat attempts while avoiding unsupported API headers. Customer portal/cancellation UX and server-side enforcement of plan limits remain separate product work. Do not switch to Live mode.
