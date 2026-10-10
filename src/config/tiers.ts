export interface Tier {
  name: 'Starter' | 'Pro' | 'Advanced';
  description: string;
  features: string[];
  priceId: { month: string; year: string };
  planId: 'starter' | 'pro' | 'unlimited';
}

export const createTiers = (prices: Record<string, string>): Tier[] => [
  {
    name: 'Starter',
    planId: 'starter',
    description: 'For small businesses that need customer records and reporting.',
    features: ['Queue and visitor management', 'Customer list and CSV export', 'Queue analytics', 'Unlimited staff logins'],
    priceId: { month: prices.starterMonthly || '', year: prices.starterAnnual || '' },
  },
  {
    name: 'Pro',
    planId: 'pro',
    description: 'For busy teams managing multiple counters and high-volume queues.',
    features: ['Everything in Starter', 'Multiple service counters', 'Advanced analytics', '5,000 visitors per month'],
    priceId: { month: prices.proMonthly || '', year: prices.proAnnual || '' },
  },
  {
    name: 'Advanced',
    planId: 'unlimited',
    description: 'For operations that need unlimited queues and visitors.',
    features: ['Everything in Pro', 'Unlimited queues', 'Unlimited visitors', 'Advanced analytics'],
    priceId: { month: prices.unlimitedMonthly || '', year: prices.unlimitedAnnual || '' },
  },
];
