type PaddleCheckout = {
  open(options: { transactionId: string }): void;
};

type PaddleJs = {
  Environment: { set(environment: 'sandbox'): void };
  Initialize(options: { token: string }): void;
  Checkout: PaddleCheckout;
};

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

let paddlePromise: Promise<PaddleJs> | undefined;
let initialized = false;

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

export async function openPaddleCheckout(transactionId: string): Promise<void> {
  if (!/^txn_[a-z\d]{26}$/i.test(transactionId)) throw new Error('Paddle returned an invalid transaction.');
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token?.startsWith('test_')) throw new Error('Paddle Sandbox client-side token is not configured.');

  const paddle = await loadPaddleJs();
  if (!initialized) {
    paddle.Environment.set('sandbox');
    paddle.Initialize({ token });
    initialized = true;
  }
  paddle.Checkout.open({ transactionId });
}
