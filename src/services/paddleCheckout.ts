import { initializePaddle, type Paddle, type PricePreviewParams, type PricePreviewResponse } from '@paddle/paddle-js';
import { supabase } from './supabaseClient';

type PlanId = 'starter' | 'pro' | 'unlimited';
type BillingCycle = 'monthly' | 'annual';
export type PaddlePricingContext = {
  environment: 'sandbox';
  countryCode?: string;
  prices: Record<'starterMonthly' | 'starterAnnual' | 'proMonthly' | 'proAnnual' | 'unlimitedMonthly' | 'unlimitedAnnual', string>;
};
type CheckoutCallbacks = {
  onClosed?: (transactionId?: string) => void;
  onCompleted?: () => void;
  onCloseError?: (error: Error) => void;
};
type CheckoutTicket = {
  priceId: string;
  plan: PlanId;
  billingCycle: BillingCycle;
  email: string | null;
  customData: Record<string, string>;
};

let paddlePromise: Promise<Paddle> | undefined;
let activeCheckout: { callbacks: CheckoutCallbacks; completed: boolean } | undefined;

export async function loadPaddlePricingContext(): Promise<PaddlePricingContext> {
  const response = await fetch('/api/paddle/pricing-context');
  const result = await response.json();
  if (!response.ok || result.environment !== 'sandbox') {
    throw new Error(result.error || 'Paddle Sandbox configuration is unavailable.');
  }
  return result as PaddlePricingContext;
}

async function getPaddle(): Promise<Paddle> {
  const context = await loadPaddlePricingContext();
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token || !token.startsWith('test_')) {
    throw new Error('Paddle Sandbox client-side token is missing or invalid.');
  }
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token,
      environment: context.environment,
      eventCallback: (event) => {
        const active = activeCheckout;
        if (!active) return;
        if (event.name === 'checkout.loaded' && event.data?.transaction_id) {
          void recordCheckoutTransaction(event.data.transaction_id);
        }
        if (event.name === 'checkout.completed') {
          active.completed = true;
          active.callbacks.onCompleted?.();
        }
        if (event.name === 'checkout.closed') {
          const transactionId = event.data?.transaction_id;
          if (!active.completed) {
            void releasePaddleCheckout(transactionId)
              .then(() => active.callbacks.onClosed?.(transactionId))
              .catch((error: unknown) => active.callbacks.onCloseError?.(
                error instanceof Error ? error : new Error('Could not close checkout.'),
              ));
          } else {
            active.callbacks.onClosed?.(transactionId);
          }
          activeCheckout = undefined;
        }
      },
    }).then((paddle) => {
      if (!paddle) throw new Error('Paddle.js did not initialize. Check the Sandbox client-side token.');
      return paddle;
    }).catch((error) => {
      paddlePromise = undefined;
      throw error;
    });
  }
  return paddlePromise;
}

export async function previewPaddlePrices(request: PricePreviewParams, countryCode?: string): Promise<PricePreviewResponse> {
  const paddle = await getPaddle();
  const contextualRequest = countryCode
    ? { ...request, address: { ...request.address, countryCode } }
    : request;
  return paddle.PricePreview(contextualRequest);
}

export async function releasePaddleCheckout(transactionId?: string): Promise<void> {
  if (!supabase) throw new Error('Please sign in before closing checkout.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in again before closing checkout.');
  const response = await fetch('/api/paddle/checkout/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ transactionId }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not close checkout.');
}

async function recordCheckoutTransaction(transactionId: string): Promise<void> {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  await fetch('/api/paddle/checkout/record-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ transactionId }),
  });
}

export async function openPaddlePriceCheckout(
  ticket: CheckoutTicket,
  callbacks: CheckoutCallbacks = {},
): Promise<void> {
  if (!/^pri_[a-z\d]{26}$/i.test(ticket.priceId)) throw new Error('Paddle returned an invalid price.');
  const paddle = await getPaddle();
  activeCheckout = { callbacks, completed: false };
  paddle.Checkout.open({
    items: [{ priceId: ticket.priceId, quantity: 1 }],
    ...(ticket.email ? { customer: { email: ticket.email } } : {}),
    customData: ticket.customData,
    settings: {
      displayMode: 'overlay',
      variant: 'one-page',
      successUrl: `${window.location.origin}/welcome`,
    },
  });
}

export async function startPaddlePlanCheckout(
  plan: PlanId,
  billingCycle: BillingCycle,
  callbacks: CheckoutCallbacks = {},
): Promise<void> {
  if (!supabase) throw new Error('Billing is not configured. Please try again later.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in before starting checkout.');
  const response = await fetch('/api/paddle/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ plan, billingCycle }),
  });
  const ticket = await response.json();
  if (ticket.code === 'checkout_in_progress') {
    callbacks.onCloseError?.(new Error(ticket.error || 'A checkout is already in progress. Close it before choosing another plan.'));
  }
  if (!response.ok || !ticket.priceId || !ticket.customData) {
    throw new Error(ticket.error || 'Could not prepare Sandbox checkout.');
  }
  try {
    await openPaddlePriceCheckout(ticket as CheckoutTicket, callbacks);
  } catch (error) {
    await releasePaddleCheckout().catch(() => undefined);
    throw error;
  }
}

// Retained for checkout links created by the previous transaction-based integration.
export async function openPaddleCheckout(transactionId: string, callbacks: CheckoutCallbacks = {}): Promise<void> {
  if (!/^txn_[a-z\d]{26}$/i.test(transactionId)) throw new Error('Paddle returned an invalid transaction.');
  const paddle = await getPaddle();
  activeCheckout = { callbacks, completed: false };
  paddle.Checkout.open({
    transactionId,
    settings: {
      displayMode: 'overlay',
      variant: 'one-page',
      successUrl: `${window.location.origin}/welcome`,
    },
  });
}
