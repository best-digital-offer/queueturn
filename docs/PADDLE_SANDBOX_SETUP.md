# QueueTurn Paddle Sandbox setup

This repository contains the initial server-side checkout and webhook endpoints. It is not payment-ready until the Sandbox catalog, Vercel environment variables, webhook destination, and end-to-end tests are completed.

## 1. Create the Sandbox catalog

In the Paddle Sandbox vendor dashboard, create recurring prices in USD for the six combinations below. Use the intended QueueTurn amounts:

| Plan | Billing interval | Amount |
|---|---|---:|
| Starter | Monthly | $19 |
| Starter | Annual | $182 |
| Pro | Monthly | $35 |
| Pro | Annual | $336 |
| Unlimited | Monthly | $50 |
| Unlimited | Annual | $480 |

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
- `subscription.updated`
- `subscription.past_due`
- `subscription.paused`
- `subscription.resumed`
- `subscription.canceled`
- `transaction.completed`

Copy the destination's signing secret to `PADDLE_WEBHOOK_SECRET`. The webhook endpoint validates `Paddle-Signature` using the raw request body and rejects invalid signatures.

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

- `api/paddle/checkout.ts`: authenticated server-side transaction creation.
- `api/paddle/webhook.ts`: signature verification, event de-duplication and initial subscription record synchronization.
- Supabase migration `add_paddle_subscription_billing`: subscription and webhook-event tables.
- `BillingTab.tsx`: paid plan buttons call the checkout endpoint.

The initial implementation still needs an end-to-end Sandbox test with real Sandbox credentials, a review of event ordering and webhook payloads, customer portal/cancellation UX, and server-side enforcement of plan limits. Do not switch to Live mode until those checks pass.
