# Project Status

## Done
- Paddle Sandbox checkout reservation can be explicitly canceled from the billing page.
- Closing an unpaid Paddle.js checkout cancels its draft transaction and releases the reservation.
- Checkout transactions are stored on their pending subscription row so cancellation can target the correct Sandbox transaction.

## In progress
- Review and deploy the checkout cancellation fix.

## Next
- Verify the deployed flow by opening and closing a Sandbox checkout, then selecting a different plan.

## Open questions
- Paddle payment completion still depends on the configured Sandbox webhook and Paddle lifecycle events.

## Decisions
- Keep the reservation guard; release it after Paddle confirms cancellation, and provide an explicit recovery action for an older stuck reservation.
- Restrict cancellation to authenticated users and Paddle Sandbox transactions.

## Verification
- `npm run lint` — passed.
- `npm run build` — passed; existing Vite `__dirname` configuration warning remains.
