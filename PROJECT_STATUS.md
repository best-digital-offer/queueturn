# Project Status

## Done
- Paddle Sandbox checkout reservation can be explicitly canceled from the billing page.
- Closing an unpaid Paddle.js checkout cancels its draft transaction and releases the reservation.
- Existing Sandbox subscriptions can preview prorated plan changes and confirm an upgrade on the same Paddle subscription.
- Billing buttons show Upgrade to the next tier for active subscribers, and the webhook syncs the new plan and billing cycle from the Paddle price.

## In progress
- Review and deploy the subscription upgrade flow.

## Next
- Verify the deployed upgrade preview endpoint, then complete a Sandbox upgrade as a signed-in customer.

## Decisions
- Keep the reservation guard for new subscriptions; upgrades update the existing Paddle subscription.
- Show the Paddle-calculated amount due now and recurring amount, then require confirmation before applying the change.
- Apply upgrades only in Paddle Sandbox, with payment failure configured to prevent the plan change.

## Verification
- `npm run lint` — passed.
- `npm run build` — passed; existing Vite `__dirname` configuration warning remains.
- Subscription upgrade has not yet been exercised with a signed-in Sandbox customer.
