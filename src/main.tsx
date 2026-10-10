import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { openPaddleCheckout } from './services/paddleCheckout';

createRoot(document.getElementById('root')!).render(<App />);

const paymentTransactionId = new URLSearchParams(window.location.search).get('_ptxn');
if (paymentTransactionId) {
  void openPaddleCheckout(paymentTransactionId).catch((error: unknown) => {
    console.error('Could not open Paddle payment link', error instanceof Error ? error.message : 'unknown');
  });
}
