# Project Status

## Done
- Paddle Sandbox checkout reservation can be explicitly canceled from the billing page.
- Closing an unpaid Paddle.js checkout cancels its draft transaction and releases the reservation.
- Existing Sandbox subscribers can preview the prorated price and upgrade their current Paddle subscription after confirming.
- Paid plan cards show upgrade actions, and Paddle webhooks sync the updated plan and billing cycle.

## Decisions
- New paid subscriptions use the checkout reservation guard; upgrades update the existing Paddle subscription.
- Show Paddle's calculated amount due now and recurring amount, then require confirmation before applying a change.
- Apply upgrades only in Paddle Sandbox, with payment failure configured to prevent the plan change.

## Verification
- `npm run lint` — passed.
- `npm run build` — passed; existing Vite `__dirname` warning remains.
- Vercel preview and production deployments — READY.
- Production route GET returns 405 and unauthenticated POST returns 401.
- No signed-in customer upgrade/payment was performed; the Sandbox account flow still needs customer verification.
