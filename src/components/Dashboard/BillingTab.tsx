import React, { useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { releasePaddleCheckout, startPaddlePlanCheckout } from '../../services/paddleCheckout';
import { PaddlePricingTable } from '../Billing/PaddlePricingTable';

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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutReservation, setCheckoutReservation] = useState(false);
  const [planChangePreview, setPlanChangePreview] = useState<PlanChangePreview | null>(null);
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
  const isPaidSubscription = !!paddleSubscriptionId
    && ['active', 'trialing', 'pending'].includes(currentStatus || '')
    && currentPlan !== 'free';

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const statusLabel: Record<string, string> = {
    active: 'Active', trialing: 'Trial period', pending: 'Payment pending',
    past_due: 'Payment past due', paused: 'Paused', canceled: 'Canceled',
  };
  const checkoutIntentStarted = useRef(false);

  const handleSelectPlan = async (planId: Exclude<PlanId, 'free'>, billingCycle: BillingCycle) => {
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
    if (!supabase) {
      setSuccessToast('Billing is not configured. Please try again later.');
      return;
    }
    setIsCheckingOut(true);
    setSuccessToast(null);
    try {
      await startPaddlePlanCheckout(planId, billingCycle, {
        onClosed: () => {
          setSuccessToast('Checkout closed. You can choose any plan now.');
          setCheckoutOpen(false);
          setCheckoutReservation(false);
        },
        onCloseError: (closeError) => {
          setCheckoutReservation(true);
          setSuccessToast(closeError.message);
          setCheckoutOpen(false);
        },
        onCompleted: () => setSuccessToast('Payment submitted. Paddle is confirming your subscription.'),
      });
      setCheckoutReservation(false);
      setCheckoutOpen(true);
    } catch (error) {
      setSuccessToast(error instanceof Error ? error.message : 'Could not start checkout.');
      setCheckoutOpen(false);
    } finally {
      setIsCheckingOut(false);
    }
  };

  useEffect(() => {
    if (isLoadingPlan || checkoutIntentStarted.current) return;
    const url = new URL(window.location.href);
    const requestedPlan = url.searchParams.get('subscribe');
    const requestedCycle = url.searchParams.get('cycle');
    if (!['starter', 'pro', 'unlimited'].includes(requestedPlan || '')
        || !['monthly', 'annual'].includes(requestedCycle || '')) return;
    checkoutIntentStarted.current = true;
    url.searchParams.delete('subscribe');
    url.searchParams.delete('cycle');
    window.history.replaceState({}, '', url.toString());
    void handleSelectPlan(requestedPlan as Exclude<PlanId, 'free'>, requestedCycle as BillingCycle);
  }, [isLoadingPlan]);

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
      setSuccessToast(`Your plan is now ${result.plan === 'pro' ? 'Pro' : result.plan === 'unlimited' ? 'Advanced' : 'Starter'} (${result.billingCycle}). Paddle confirmed the change.`);
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

      <PaddlePricingTable
        currentPlan={currentPlan}
        currentBillingCycle={currentBillingCycle}
        initialCycle={new URLSearchParams(window.location.search).get('cycle') === 'annual' ? 'annual' : 'monthly'}
        onSubscribe={(planId, cycle) => void handleSelectPlan(planId, cycle)}
        busy={isLoadingPlan || isCheckingOut || isUpdatingSubscription || checkoutOpen}
      />

      {planChangePreview && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="plan-change-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <h2 id="plan-change-title" className="text-xl font-extrabold text-slate-900">Confirm your plan change</h2>
          <p className="mt-2 text-sm text-slate-600">{planChangePreview.plan === currentPlan ? 'Change your billing cycle' : `Upgrade to ${planChangePreview.plan === 'pro' ? 'Pro' : planChangePreview.plan === 'unlimited' ? 'Advanced' : 'Starter'}`} with {planChangePreview.billingCycle} billing.</p>
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
