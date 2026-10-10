import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const WelcomePage: React.FC<{ onContinue: () => void }> = ({ onContinue }) => (
  <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-slate-50 px-4 py-16">
    <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
      <h1 className="mt-5 text-3xl font-extrabold text-slate-900">Welcome to QueueTurn</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">Checkout is complete. Paddle is confirming your subscription; your plan will appear in Billing as soon as the confirmation reaches us.</p>
      <button type="button" onClick={onContinue} className="mt-7 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700">Continue to QueueTurn</button>
    </section>
  </main>
);
