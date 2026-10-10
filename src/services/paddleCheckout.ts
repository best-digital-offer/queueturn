import { supabase } from './supabaseClient';

type PaddleCheckout = {
  open(options: { transactionId: string }): void;
};

type PaddleEvent = {
  name: string;
  data?: { transaction_id?: string; status?: string };
};
type CheckoutCallbacks = {
  onClosed?: () => void;
  onCompleted?: () => void;
  onCloseError?: (error: Error) => void;
};
type PaddleJs = {
  Environment: { set(environment: 'sandbox'): void };
  Initialize(options: { token: string; eventCallback: (event: PaddleEvent) => void }): void;
  Checkout: PaddleCheckout;
};

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

let paddlePromise: Promise<PaddleJs> | undefined;
let initialized = false;
let activeCheckout: { transactionId: string; callbacks: CheckoutCallbacks; completed: boolean } | undefined;

export async function releasePaddleCheckout(): Promise<void> {
  if (!supabase) throw new Error('Please sign in before closing checkout.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in again before closing checkout.');
  const response = await fetch('/api/paddle/checkout/cancel', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not close checkout.');
}

function loadPaddleJs(): Promise<PaddleJs> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (paddlePromise) return paddlePromise;

  paddlePromise = new Promise<PaddleJs>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-paddle-js]');
    const script = existingScript || document.createElement('script');
    const onLoad = () => window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle.js did not initialize.'));
    const onError = () => reject(new Error('Could not load Paddle checkout. Please try again.'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existingScript) {
      script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      script.async = true;
      script.dataset.paddleJs = 'true';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    paddlePromise = undefined;
    throw error;
  });

  return paddlePromise;
}

export async function openPaddleCheckout(transactionId: string, callbacks: CheckoutCallbacks = {}): Promise<void> {
  if (!/^txn_[a-z\d]{26}$/i.test(transactionId)) throw new Error('Paddle returned an invalid transaction.');
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token?.startsWith('test_')) throw new Error('Paddle Sandbox client-side token is not configured.');

  const paddle = await loadPaddleJs();
  if (!initialized) {
    paddle.Environment.set('sandbox');
    paddle.Initialize({
      token,
      eventCallback: (event) => {
        const active = activeCheckout;
        if (!active || (event.data?.transaction_id && event.data.transaction_id !== active.transactionId)) return;
        if (event.name === 'checkout.completed') {
          active.completed = true;
          active.callbacks.onCompleted?.();
        }
        if (event.name === 'checkout.closed') {
          if (!active.completed) {
            void releasePaddleCheckout()
              .then(() => active.callbacks.onClosed?.())
              .catch((error: unknown) => active.callbacks.onCloseError?.(
                error instanceof Error ? error : new Error('Could not close checkout.'),
              ));
          } else {
            active.callbacks.onClosed?.();
          }
          activeCheckout = undefined;
        }
      },
    });
    initialized = true;
  }
  activeCheckout = { transactionId, callbacks, completed: false };
  paddle.Checkout.open({ transactionId });
}
