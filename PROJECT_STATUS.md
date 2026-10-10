# Project Status

## Done
- Paddle Sandbox checkout reservations can be closed from the billing page, and closing an unpaid Paddle.js checkout cancels the draft transaction and releases the reservation.
- Existing Sandbox subscriptions can preview prorated plan changes and confirm an upgrade on the same Paddle subscription.
- Added a country-aware Starter, Pro, and Advanced pricing table with monthly/yearly prices from Paddle `PricePreview` and exact-price Paddle.js overlay checkout.
- New checkout metadata is signed server-side and verified before the webhook associates it with a Supabase user.
- Successful checkout redirects to `/welcome`; signed-in customer email is prefilled.
- Sandbox-only configuration fails closed; `.env.example` documents the required variables and Dashboard payment-link setup.

## In progress
- Complete an authenticated Sandbox checkout test and redirect verification.

## Next
- Confirm Sandbox localized prices and checkout overlay open/close on the deployed preview.
- Complete a Sandbox payment and verify `/welcome` redirect using a separate Sandbox customer account; do not disrupt the existing Starter subscription.
- Confirm the Sandbox catalog product currently mapped to Advanced is named appropriately.

## Open questions
- The six existing Paddle price IDs use the internal `unlimited` key and are displayed as “Advanced” in QueueTurn. Paddle checkout uses the product name in its catalog, so rename that Sandbox product to “Advanced” in Paddle if it currently says “Unlimited.”
- The Sandbox default payment link must be set in Paddle Dashboard under Checkout > Checkout configuration.

## Decisions
- Keep the existing reservation guard for new subscriptions; upgrades change the existing Paddle subscription.
- Use only explicit Paddle Sandbox configuration in this branch and never call Paddle Live.
- Display Paddle's formatted preview totals without frontend price calculations.

## Verification
- `npm run lint` — passed.
- `npm run build` — passed; existing Vite `__dirname` configuration warning remains.
- `npm test` — passed (18 tests).
- Vercel preview — ready; browser verification confirmed all three localized monthly and yearly Paddle totals render in India.
- Public Subscribe CTA correctly starts authentication, but Checkout overlay testing requires an authenticated customer. The test browser is unauthenticated and no payment was submitted.
- Sandbox checkout completion has not yet been exercised; an existing active subscription must not be changed solely for test verification.
