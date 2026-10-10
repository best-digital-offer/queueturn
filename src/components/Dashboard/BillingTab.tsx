import React, { useEffect, useState } from 'react';
import { Check, X, CreditCard, Sparkles } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { openPaddleCheckout, releasePaddleCheckout } from '../../services/paddleCheckout';

type PlanId = 'free' | 'starter' | 'pro' | 'unlimited';
type BillingCycle = 'monthly' | 'annual';
type PlanChangePreview = {
  plan: Exclude<PlanId, 'free'>;
  billingCycle: BillingCycle;
  immediateTotal: string;
  recurringTotal: string | null;
  currencyCode: string;
};
const planRank: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, unlimited: 3 };

function formatPaddleAmount(amount: string, currencyCode: string): string {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(Number(amount) / (10 ** digits));
}

export const BillingTab: React.FC = () => {
  // The database subscription record is authoritative; never trust a browser-stored plan.
  const [currentPlan, setCurrentPlan] = useState<PlanId>('free');
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentBillingCycle, setCurrentBillingCycle] = useState<BillingCycle | null>(null);
  const [paddleSubscriptionId, setPaddleSubscriptionId] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadPlan = async () => {
      if (!supabase) {
        if (!cancelled) setIsLoadingPlan(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        setCurrentPlan('free');
        setCurrentStatus(null);
        setCurrentBillingCycle(null);
        setPaddleSubscriptionId(null);
        setIsLoadingPlan(false);
        return;
      }
      const { data, error } = await supabase
        .from('billing_subscriptions')
        .select('plan,status,billing_cycle,paddle_subscription_id,updated_at,current_period_end,cancel_at_period_end')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setCurrentStatus(data.status);
        setCurrentBillingCycle(data.billing_cycle === 'monthly' || data.billing_cycle === 'annual' ? data.billing_cycle : null);
        setPaddleSubscriptionId(typeof data.paddle_subscription_id === 'string' ? data.paddle_subscription_id : null);
      } else {
        setCurrentStatus(null);
        setCurrentBillingCycle(null);
        setPaddleSubscriptionId(null);
      }
      if (!error && data && (['active', 'trialing'].includes(data.status)
          || (data.status === 'pending' && typeof data.paddle_subscription_id === 'string'))
          && ['starter', 'pro', 'unlimited'].includes(data.plan)) {
        setCurrentPlan(data.plan as PlanId);
      } else {
        setCurrentPlan('free');
      }
      setIsLoadingPlan(false);
    };
    void loadPlan();
    const { data: authListener } = supabase?.auth.onAuthStateChange(() => { void loadPlan(); }) || { data: { subscription: { unsubscribe: () => {} } } };
    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutReservation, setCheckoutReservation] = useState(false);
  const [planChangePreview, setPlanChangePreview] = useState<PlanChangePreview | null>(null);
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
  const isPaidSubscription = !!paddleSubscriptionId
    && ['active', 'trialing', 'pending'].includes(currentStatus || '')
    && currentPlan !== 'free';

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
  const statusLabel: Record<string, string> = {
    active: 'Active', trialing: 'Trial period', pending: 'Payment pending',
    past_due: 'Payment past due', paused: 'Paused', canceled: 'Canceled',
  };

  const handleSelectPlan = async (planId: PlanId) => {
    if (isCheckingOut || checkoutOpen || isUpdatingSubscription) return;
    if (isPaidSubscription) {
      const isUpgrade = planRank[planId] > planRank[currentPlan];
      const isCycleChange = planId === currentPlan && billingCycle !== currentBillingCycle;
      if (!isUpgrade && !isCycleChange) return;
      if (!supabase) {
        setSuccessToast('Billing is not configured. Please try again later.');
        return;
      }
      setIsCheckingOut(true);
      setSuccessToast(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Please sign in again before changing your subscription.');
        const response = await fetch('/api/paddle/subscription/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ action: 'preview', plan: planId, billingCycle }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not preview the subscription change.');
        setPlanChangePreview(result as PlanChangePreview);
      } catch (error) {
        setSuccessToast(error instanceof Error ? error.message : 'Could not preview the subscription change.');
      } finally {
        setIsCheckingOut(false);
      }
      return;
    }

    if (currentStatus === 'pending' && paddleSubscriptionId) {
      setSuccessToast('Paddle is confirming your payment. Plan changes will be available once it is confirmed.');
      return;
    }
    if (planId === currentPlan) return;
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
    let checkoutStarted = false;
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
      if (result.code === 'checkout_in_progress') setCheckoutReservation(true);
      if (!response.ok || !result.transactionId) throw new Error(result.error || 'Could not start checkout.');
      setCheckoutReservation(false);
      checkoutStarted = true;
      setCheckoutOpen(true);
      await openPaddleCheckout(result.transactionId, {
        onClosed: () => {
          setSuccessToast('Checkout closed. You can choose any plan now.');
          setCheckoutOpen(false);
        },
        onCloseError: (closeError) => {
          setCheckoutReservation(true);
          setSuccessToast(closeError.message);
          setCheckoutOpen(false);
        },
        onCompleted: () => {
          setSuccessToast('Payment submitted. Paddle is confirming your subscription.');
        },
      });
    } catch (error) {
      setSuccessToast(error instanceof Error ? error.message : 'Could not start checkout.');
      if (checkoutStarted) {
        setCheckoutOpen(false);
        try {
          await releasePaddleCheckout();
        } catch {
          // Keep the server-side reservation if its checkout could not be safely canceled.
        }
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const confirmPlanChange = async () => {
    if (!planChangePreview || !supabase || isUpdatingSubscription) return;
    setIsUpdatingSubscription(true);
    setSuccessToast(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before changing your subscription.');
      const response = await fetch('/api/paddle/subscription/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({
          action: 'apply',
          plan: planChangePreview.plan,
          billingCycle: planChangePreview.billingCycle,
          expectedImmediateTotal: planChangePreview.immediateTotal,
          expectedRecurringTotal: planChangePreview.recurringTotal || '',
          expectedCurrencyCode: planChangePreview.currencyCode,
        }),
      });
      const result = await response.json();
      if (result.code === 'preview_changed') {
        setPlanChangePreview(result as PlanChangePreview);
        setSuccessToast(result.error || 'The price changed. Review the new amount before confirming.');
        return;
      }
      if (!response.ok || !result.updated) throw new Error(result.error || 'Paddle could not apply the subscription change.');
      setCurrentPlan(result.plan as PlanId);
      setCurrentBillingCycle(result.billingCycle as BillingCycle);
      setCurrentStatus(result.status || currentStatus);
      setPlanChangePreview(null);
      setSuccessToast(`Your plan is now ${result.plan === 'pro' ? 'Pro' : result.plan === 'unlimited' ? 'Unlimited' : 'Starter'} (${result.billingCycle}). Paddle confirmed the change.`);
    } catch (error) {
      setSuccessToast(error instanceof Error ? error.message : 'Paddle could not apply the subscription change.');
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Subscription & Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Simple, transparent plans for your queue operations. Prices are in USD.</p>
          {currentStatus && <p aria-live="polite" className="mt-1 text-xs font-semibold text-slate-600">Subscription status: {statusLabel[currentStatus] || currentStatus}</p>}
        </div>
      </div>

      {successToast && <div role="status" aria-live="polite" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold">{successToast}</div>}
      {checkoutReservation && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <span>A previous checkout is still open. Close and cancel it to safely choose a different plan.</span>
        <button type="button" onClick={async () => {
          if (!supabase) return;
          setIsCheckingOut(true);
          try {
            await releasePaddleCheckout();
            setCheckoutReservation(false);
            setSuccessToast('Previous checkout closed. Choose any plan to try again.');
          } catch (error) {
            setSuccessToast(error instanceof Error ? error.message : 'Could not close the previous checkout.');
          } finally {
            setIsCheckingOut(false);
          }
        }} disabled={isCheckingOut} className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 font-bold text-white disabled:opacity-60">
          {isCheckingOut ? 'Closing checkout…' : 'Close previous checkout'}
        </button>
      </div>}

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
          const isCurrentCycle = isCurrent && currentBillingCycle === billingCycle;
          const belowCurrentPlan = isPaidSubscription && planRank[plan.id] < planRank[currentPlan];
          const planButtonLabel = isPaidSubscription
              ? belowCurrentPlan
                ? 'Below current plan'
                : isCurrent
                  ? isCurrentCycle ? 'Current Plan' : `Change to ${billingCycle === 'annual' ? 'annual' : 'monthly'} billing`
                  : `Upgrade to ${plan.name}`
              : isCurrent ? 'Current Plan' : plan.cta;
          const planButtonDisabled = isLoadingPlan || isCheckingOut || isUpdatingSubscription || checkoutOpen
            || belowCurrentPlan || (isPaidSubscription && isCurrentCycle)
            || (!isPaidSubscription && isCurrent);
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
              <div className="p-5 pt-0 mt-auto"><button onClick={() => handleSelectPlan(plan.id)} disabled={planButtonDisabled} className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition text-center disabled:cursor-default ${planButtonDisabled ? 'bg-slate-100 text-slate-500' : plan.popular ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-200' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>{isLoadingPlan ? 'Checking plan…' : isCheckingOut ? (isPaidSubscription ? 'Calculating change…' : 'Opening checkout…') : planButtonLabel}</button></div>
            </div>
          );
        })}
      </div>

      {planChangePreview && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="plan-change-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <h2 id="plan-change-title" className="text-xl font-extrabold text-slate-900">Confirm your plan change</h2>
          <p className="mt-2 text-sm text-slate-600">{planChangePreview.plan === currentPlan ? 'Change your billing cycle' : `Upgrade to ${planChangePreview.plan === 'pro' ? 'Pro' : planChangePreview.plan === 'unlimited' ? 'Unlimited' : 'Starter'}`} with {planChangePreview.billingCycle} billing.</p>
          <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-slate-600">Due today</span><strong className="text-slate-900">{formatPaddleAmount(planChangePreview.immediateTotal, planChangePreview.currencyCode)}</strong></div>
            {planChangePreview.recurringTotal !== null && <div className="flex justify-between gap-4"><span className="text-slate-600">Recurring after change</span><strong className="text-slate-900">{formatPaddleAmount(planChangePreview.recurringTotal, planChangePreview.currencyCode)} / {planChangePreview.billingCycle === 'annual' ? 'year' : 'month'}</strong></div>}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">The amount due today is prorated for the time left in your current billing period. Paddle will keep your existing plan if payment fails.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setPlanChangePreview(null)} disabled={isUpdatingSubscription} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void confirmPlanChange()} disabled={isUpdatingSubscription} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{isUpdatingSubscription ? 'Applying change…' : planChangePreview.plan === currentPlan ? 'Confirm billing change' : 'Confirm upgrade'}</button>
          </div>
        </section>
      </div>}

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2"><CreditCard className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" /><span><strong>Billing status:</strong> Your current plan is read from the verified subscription record. Paid plan checkout requires configured Paddle credentials and price IDs. Server-side usage limits are not yet enforced.</span></div>
    </div>
  );
};
