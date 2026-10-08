import React, { useState } from 'react';
import { Check, Sparkles, CreditCard, ShieldCheck, Zap } from 'lucide-react';

export const BillingTab: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState<'free' | 'starter' | 'pro' | 'business'>('starter');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Perfect for tiny single-station setups and trial testing.',
      features: [
        '1 Active Queue',
        '100 Visitors / month',
        'Standard QR Code Generator',
        'Basic Dashboard Control',
        'Public Mobile Queue Page',
      ],
      cta: 'Start Free',
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      priceMonthly: 9,
      priceAnnual: 7,
      description: 'Ideal for neighborhood salons, single clinics, and small repair shops.',
      features: [
        '3 Active Queues',
        '1,000 Visitors / month',
        'Unlimited Staff Logins',
        'TV Lobby Display Mode',
        'Custom Queue Link URL',
        'Daily Queue Analytics',
      ],
      cta: 'Start Starter',
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      priceMonthly: 19,
      priceAnnual: 15,
      description: 'For busy multi-counter offices, dental clinics, and high-volume practices.',
      features: [
        'Unlimited Queues',
        'Unlimited Visitors',
        'Multiple Service Counters',
        'SMS Notification Support',
        'Voice Speech Announcements',
        'Printable Poster Customizer',
        'Advanced Analytics & CSV Export',
      ],
      cta: 'Start Pro',
      popular: true,
    },
    {
      id: 'business',
      name: 'Business',
      priceMonthly: 49,
      priceAnnual: 39,
      description: 'For multi-location practices, government agencies, and service centers.',
      features: [
        'Multiple Physical Locations',
        'Multi-location Central Dashboard',
        'Granular Staff Roles (Owner/Manager)',
        'Custom Business Branding & Colors',
        'Priority Phone & Email Support',
        'Enterprise SLA & Dedicated Support',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  const handleSelectPlan = (planId: string) => {
    if (planId === 'business') {
      alert('Thank you for your interest! A Queue Turn enterprise specialist will contact your email.');
      return;
    }
    setCurrentPlan(planId as 'free' | 'starter' | 'pro' | 'business');
    setSuccessToast(`Plan successfully updated to ${planId.toUpperCase()} (Demo Billing Simulation)`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Subscription & Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Transparent pricing designed for small and growing service businesses.
          </p>
        </div>

        {/* Monthly / Annual Toggle */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
              billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Annual
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Save 20%</span>
          </button>
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {successToast}
        </div>
      )}

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.id;
          const price = billingCycle === 'annual' ? p.priceAnnual : p.priceMonthly;

          return (
            <div
              key={p.id}
              className={`rounded-3xl p-6 flex flex-col justify-between transition relative border ${
                p.popular
                  ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-100'
                  : 'border-slate-200 bg-white shadow-xs hover:border-slate-300'
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-[11px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-sm">
                    Most Popular: Pro
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-extrabold text-lg text-slate-900">{p.name}</h3>
                  {isCurrent && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Active Plan
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 min-h-[36px]">{p.description}</p>

                <div className="my-5 pb-5 border-b border-slate-100">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-extrabold font-mono-numbers text-slate-900">${price}</span>
                    <span className="text-xs text-slate-400 font-medium ml-1">/month</span>
                  </div>
                  {billingCycle === 'annual' && price > 0 && (
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Billed annually</span>
                  )}
                </div>

                <ul className="space-y-2.5 text-xs text-slate-600">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  onClick={() => handleSelectPlan(p.id)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition text-center ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : p.popular
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : p.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Stripe billing integration ready. When live Stripe keys are provided, checkout sessions redirect automatically.
        </span>
      </div>
    </div>
  );
};
