import React, { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { PricePreviewResponse } from '@paddle/paddle-js';
import { createTiers } from '../../config/tiers';
import { loadPaddlePricingContext, previewPaddlePrices } from '../../services/paddleCheckout';

type PlanId = 'free' | 'starter' | 'pro' | 'unlimited';
type BillingCycle = 'monthly' | 'annual';
const ranks: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, unlimited: 3 };

type Props = {
  currentPlan?: PlanId;
  currentBillingCycle?: BillingCycle | null;
  initialCycle?: BillingCycle;
  onSubscribe: (plan: Exclude<PlanId, 'free'>, cycle: BillingCycle) => void;
  busy?: boolean;
};

export const PaddlePricingTable: React.FC<Props> = ({ currentPlan = 'free', currentBillingCycle = null, initialCycle = 'monthly', onSubscribe, busy = false }) => {
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceIds, setPriceIds] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | undefined>();
  const tiers = createTiers(priceIds);

  useEffect(() => {
    let cancelled = false;
    const loadPrices = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const context = await loadPaddlePricingContext();
        if (cancelled) return;
        setCountryCode(context.countryCode);
        setPriceIds(context.prices);
        const priceIds = tiersForCycle(context.prices, cycle);
        const result: PricePreviewResponse = await previewPaddlePrices({
          items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
        }, context.countryCode);
        if (cancelled) return;
        const totals: Record<string, string> = {};
        for (const item of result.data.details.lineItems) {
          if (item.formattedTotals?.total) totals[item.price.id] = item.formattedTotals.total;
        }
        setPrices((previous) => ({ ...previous, ...totals }));
        if (Object.keys(totals).length !== 3) throw new Error('Paddle did not return prices for all three plans.');
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Localized prices could not be loaded.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadPrices();
    return () => { cancelled = true; };
  }, [cycle]);

  return (
    <div>
      <div className="flex flex-col items-center gap-2 mb-7">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Choose billing cycle</p>
        <div role="tablist" aria-label="Pricing billing cycle" className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
          <button type="button" role="tab" aria-selected={cycle === 'monthly'} onClick={() => setCycle('monthly')} className={cycle === 'monthly' ? 'rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-sm' : 'rounded-lg px-5 py-2.5 text-sm font-bold text-slate-500'}>Monthly</button>
          <button type="button" role="tab" aria-selected={cycle === 'annual'} onClick={() => setCycle('annual')} className={cycle === 'annual' ? 'rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-sm' : 'rounded-lg px-5 py-2.5 text-sm font-bold text-slate-500'}>Yearly</button>
        </div>
      </div>
      {countryCode && <p className="mb-4 text-center text-xs text-slate-500">Localized prices for {countryCode}</p>}
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier, index) => {
          const current = currentPlan === tier.planId;
          const lower = ranks[tier.planId] < ranks[currentPlan];
          const priceId = cycle === 'monthly' ? tier.priceId.month : tier.priceId.year;
          const formattedPrice = prices[priceId];
          const label = current
            ? currentBillingCycle === cycle ? 'Current plan' : `Change to ${cycle === 'annual' ? 'yearly' : 'monthly'} billing`
            : lower ? 'Below current plan' : currentPlan !== 'free' ? `Upgrade to ${tier.name}` : `Subscribe to ${tier.name}`;
          return (
            <section key={tier.name} className={`flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${index === 1 ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
              {index === 1 && <div className="mb-3 flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><Sparkles className="h-4 w-4" />Most popular</div>}
              <h3 className="text-xl font-extrabold text-slate-900">{tier.name}</h3>
              <p className="mt-2 min-h-10 text-sm text-slate-500">{tier.description}</p>
              <div className="my-6 border-b border-slate-100 pb-5" aria-live="polite">
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">{isLoading ? 'Loading…' : formattedPrice || 'Price unavailable'}</div>
                <div className="mt-1 text-xs text-slate-500">per {cycle === 'monthly' ? 'month' : 'year'}{cycle === 'annual' ? ', billed yearly' : ''}</div>
              </div>
              <ul className="mb-6 flex-1 space-y-3 text-sm text-slate-600">
                {tier.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}
              </ul>
              <button type="button" onClick={() => onSubscribe(tier.planId, cycle)} disabled={isLoading || !!error || !formattedPrice || busy || lower || (current && currentBillingCycle === cycle)} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
                {busy ? 'Opening checkout…' : label}
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
};

function tiersForCycle(prices: Record<string, string>, cycle: BillingCycle): string[] {
  const ids = cycle === 'monthly'
    ? [prices.starterMonthly, prices.proMonthly, prices.unlimitedMonthly]
    : [prices.starterAnnual, prices.proAnnual, prices.unlimitedAnnual];
  if (ids.some((id) => !id)) throw new Error('Paddle price IDs are not fully configured.');
  return ids;
}
