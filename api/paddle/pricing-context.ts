type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined> };
type VercelResponse = { setHeader(name: string, value: string): void; status(code: number): VercelResponse; json(body: unknown): VercelResponse };

const priceEnvironment = {
  starterMonthly: 'PADDLE_PRICE_STARTER_MONTHLY',
  starterAnnual: 'PADDLE_PRICE_STARTER_ANNUAL',
  proMonthly: 'PADDLE_PRICE_PRO_MONTHLY',
  proAnnual: 'PADDLE_PRICE_PRO_ANNUAL',
  unlimitedMonthly: 'PADDLE_PRICE_UNLIMITED_MONTHLY',
  unlimitedAnnual: 'PADDLE_PRICE_UNLIMITED_ANNUAL',
} as const;

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (process.env.PADDLE_ENVIRONMENT !== 'sandbox') {
    return res.status(503).json({ error: 'Paddle pricing is unavailable: PADDLE_ENVIRONMENT must be explicitly set to sandbox.' });
  }
  if (!process.env.VITE_PADDLE_CLIENT_TOKEN?.startsWith('test_')) {
    return res.status(503).json({ error: 'Paddle pricing is unavailable: configure a Sandbox client-side token.' });
  }
  const prices = Object.fromEntries(Object.entries(priceEnvironment).map(([name, env]) => [name, process.env[env] || '']));
  if (Object.values(prices).some((priceId) => typeof priceId !== 'string' || !/^pri_[a-z\d]{26}$/i.test(priceId))) {
    return res.status(503).json({ error: 'Paddle pricing is unavailable: configure all six Sandbox prices.' });
  }
  const rawCountry = req.headers['x-vercel-ip-country'];
  const countryCode = typeof rawCountry === 'string' && /^[A-Za-z]{2}$/.test(rawCountry)
    ? rawCountry.toUpperCase()
    : undefined;
  return res.status(200).json({ environment: 'sandbox', prices, ...(countryCode ? { countryCode } : {}) });
}
