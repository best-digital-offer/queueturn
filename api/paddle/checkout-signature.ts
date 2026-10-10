import { createHmac, timingSafeEqual } from 'node:crypto';

export function signedSupabaseUserId(custom: Record<string, unknown>, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  const userId = custom.supabase_user_id;
  const plan = custom.plan;
  const billingCycle = custom.billing_cycle;
  const issuedAt = custom.checkout_issued_at;
  const signature = custom.checkout_signature;
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)
      || !['starter', 'pro', 'unlimited'].includes(String(plan))
      || !['monthly', 'annual'].includes(String(billingCycle))
      || typeof issuedAt !== 'string' || !/^\d{10}$/.test(issuedAt)
      || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return null;
  const age = nowSeconds - Number(issuedAt);
  if (age < -300 || age > 86_400) return null;
  const expected = createHmac('sha256', secret)
    .update(`${userId}:${plan}:${billingCycle}:${issuedAt}`)
    .digest();
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received) ? userId : null;
}
