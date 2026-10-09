import React, { useState } from 'react';
import { Check, X, CreditCard, Sparkles } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

type PlanId = 'free' | 'starter' | 'pro' | 'unlimited';
type BillingCycle = 'monthly' | 'annual';

export const BillingTab: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState<PlanId>(() => {
    if (typeof window === 'undefined') return 'free';
    const saved = window.localStorage.getItem('queueturn-plan');
    return saved === 'starter' || saved === 'pro' || saved === 'unlimited' || saved === 'free' ? saved : 'free';
  });
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const plans: { id: PlanId; name: string; monthly: number; annual: number; description: string; features: { label: string; included: boolean }[]; cta: string; popular?: boolean }[] = [
    { id: 'free', name: 'Free', monthly: 0, annual: 0, description: 'Get started with the essentials for your business.', features: [
      { label: '7 Active Queues/month', included: true }, { label: '50 Visitors / month', included: true },
      { label: 'Standard QR Code Generator', included: true }, { label: 'Basic Dashboard Control', included: true },
      { label: 'Public Mobile Queue Page', included: true }, { label: 'TV Screen for 1 Queue', included: true },
      { label: 'Customer List', included: false }, { label: 'Analytics', included: false }, { label: 'CSV Export', included: false },
    ], cta: 'Free Plan' },
    { id: 'starter', name: 'Starter', monthly: 19, annual: 182, description: 'For small businesses that need customer records and reporting.', features: [
      { label: billingCycle === 'monthly' ? '30 Active Queues/month' : '75 Active Queues/month', included: true }, { label: billingCycle === 'monthly' ? 'Visitor allowance (monthly billing)' : 'Visitor allowance (annual billing)', included: true },
      { label: 'Standard QR Code Generator', included: true }, { label: 'Basic Dashboard Control', included: true },
      { label: 'Public Mobile Queue Page', included: true }, { label: 'TV Screen for 1 Queue', included: true },
      { label: 'Customer List', included: true }, { label: 'Queue Analytics', included: true }, { label: 'CSV Export', included: true },
      { label: 'Unlimited Staff Logins', included: true }, { label: 'TV Lobby Display Mode', included: true },
      { label: 'Custom Queue Link URL', included: true }, { label: 'Daily Queue Analytics', included: true },
    ], cta: 'Choose Starter' },
    { id: 'pro', name: 'Pro', monthly: 35, annual: 336, description: 'For busy teams managing multiple counters and high-volume queues.', features: [
      { label: billingCycle === 'monthly' ? '100 Active Queues/month' : '150 Active Queues/month', included: true }, { label: '5,000 Visitors / month', included: true },
      { label: 'Customer List & CSV Export', included: true }, { label: 'Advanced Analytics', included: true },
      { label: 'Multiple Service Counters', included: true }, { label: 'Standard QR Code Generator', included: true },
      { label: 'Basic Dashboard Control', included: true }, { label: 'Public Mobile Queue Page', included: true },
      { label: 'TV Lobby Display Mode', included: true }, { label: 'Custom Queue Link URL', included: true },
      { label: 'Daily Queue Analytics', included: true },
    ], cta: 'Choose Pro', popular: true },
    { id: 'unlimited', name: 'Unlimited', monthly: 50, annual: 480, description: 'For operations that need unlimited queues and visitors.', features: [
      { label: 'Unlimited Queues', included: true }, { label: 'Unlimited Visitors', included: true },
      { label: 'Customer List & CSV Export', included: true }, { label: 'Advanced Analytics', included: true },
      { label: 'Multiple Service Counters', included: true }, { label: 'Standard QR Code Generator', included: true },
      { label: 'Basic Dashboard Control', included: true }, { label: 'Public Mobile Queue Page', included: true },
      { label: 'TV Lobby Display Mode', included: true }, { label: 'Custom Queue Link URL', included: true },
      { label: 'Daily Queue Analytics', included: true },
    ], cta: 'Choose Unlimited' },
  ];

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === currentPlan || isCheckingOut) return;
    if (planId === 'free') {
      setSuccessToast('Free plan selected for preview. Paid subscriptions must be cancelled through the billing provider before downgrading.');
      return;
    }
    if (!supabase) {
      setSuccessToast('Billing is not configured. Please try again later.');
      return;
    }
    setIsCheckingOut(true);
    setSuccessToast(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSuccessToast('Please sign in again before starting checkout.');
        return;
      }
      const response = await fetch('/api/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ plan: planId, billingCycle }),
      });
      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || 'Could not start checkout.');
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setSuccessToast(error instanceof Error ? error.message : 'Could not start checkout.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Subscription & Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Simple, transparent plans for your queue operations. Prices are in USD.</p>
        </div>
      </div>

      {successToast && <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold">{successToast}</div>}

      <div className="flex flex-col items-center gap-2 pt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Choose your billing cycle</p>
        <div role="tablist" aria-label="Billing cycle" className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
          <button type="button" role="tab" aria-selected={billingCycle === "monthly"} onClick={() => setBillingCycle("monthly")} className={billingCycle === "monthly" ? "rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-sm" : "rounded-lg px-5 py-2.5 text-sm font-bold text-slate-500"}>Monthly</button>
          <button type="button" role="tab" aria-selected={billingCycle === "annual"} onClick={() => setBillingCycle("annual")} className={billingCycle === "annual" ? "rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-sm" : "rounded-lg px-5 py-2.5 text-sm font-bold text-slate-500"}>Annual <span className="ml-1 text-[10px] font-extrabold text-emerald-600">SAVE ~20%</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 pt-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id} className={`relative flex flex-col rounded-3xl border transition-all duration-200 ${plan.popular ? 'border-indigo-500 bg-gradient-to-b from-indigo-50 via-white to-white ring-2 ring-indigo-400 shadow-xl shadow-indigo-200/70 xl:-translate-y-1' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'}`}>
              {plan.popular && <div className="mx-4 -mt-3 mb-1 relative z-10 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-lg shadow-indigo-300 ring-2 ring-white whitespace-nowrap"><Sparkles className="w-3.5 h-3.5" />Most Popular</span></div>}
              <div className="flex-1 p-5 pt-4">
                <div className="flex items-center justify-between gap-2 mb-2"><h3 className="font-extrabold text-lg text-slate-900">{plan.name}</h3>{isCurrent && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 whitespace-nowrap">Current Plan</span>}</div>
                <p className="text-xs leading-relaxed text-slate-500 min-h-[42px]">{plan.description}</p>
                <div className="my-5 pb-5 border-b border-slate-100">
                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{billingCycle === "monthly" ? "Monthly price" : "Annual price"}</p>
                  <div className="flex items-baseline gap-1"><span className="text-4xl font-extrabold tracking-tight text-slate-900">${billingCycle === "monthly" ? plan.monthly : plan.annual}</span><span className="text-xs text-slate-400 font-medium">{billingCycle === "monthly" ? "/month" : "/year"}</span></div>
                  {plan.monthly > 0 && billingCycle === "annual" && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Save ${plan.monthly * 12 - plan.annual} per year vs monthly billing</p>}
                  {plan.monthly > 0 && billingCycle === "monthly" && <p className="mt-1 text-[11px] text-slate-500">Billed monthly</p>}
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  {plan.features.map((feature) => <li key={feature.label} className={`flex items-start gap-2 ${feature.included ? '' : 'text-slate-400'}`}>{feature.included ? <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}<span className={feature.included ? '' : 'line-through'}>{feature.label}</span></li>)}
                </ul>
              </div>
              <div className="p-5 pt-0 mt-auto"><button onClick={() => handleSelectPlan(plan.id)} disabled={isCurrent || isCheckingOut} className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition text-center disabled:cursor-default ${isCurrent ? 'bg-slate-100 text-slate-400' : plan.popular ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-200' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>{isCurrent ? 'Current Plan' : isCheckingOut ? 'Opening checkout…' : plan.cta}</button></div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2"><CreditCard className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" /><span><strong>Billing status:</strong> Paid plan checkout uses Paddle when Sandbox credentials and price IDs are configured. Your paid plan activates only after a verified Paddle webhook; plan limits still need server-side enforcement.</span></div>
    </div>
  );
};
