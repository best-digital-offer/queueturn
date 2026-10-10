-- Store Paddle event ordering and reserve one pending checkout per user.
-- All changes are additive; existing subscription and webhook rows are preserved.
alter table public.billing_subscriptions
  add column if not exists paddle_event_occurred_at timestamptz,
  add column if not exists paddle_event_id text;

create unique index if not exists billing_subscriptions_pending_checkout_user_id_idx
  on public.billing_subscriptions (user_id)
  where paddle_subscription_id is null and status = 'pending';

create or replace function public.reserve_paddle_checkout(
  p_plan text,
  p_billing_cycle text
)
returns table (reserved boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.billing_subscriptions%rowtype;
begin
  if v_user_id is null then
    return query select false, 'unauthenticated'::text;
    return;
  end if;
  if p_plan not in ('starter', 'pro', 'unlimited') or p_billing_cycle not in ('monthly', 'annual') then
    return query select false, 'invalid_plan'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1 from public.billing_subscriptions
    where user_id = v_user_id
      and status in ('active', 'trialing', 'past_due', 'paused')
  ) then
    return query select false, 'active_subscription'::text;
    return;
  end if;

  if exists (
    select 1 from public.billing_subscriptions
    where user_id = v_user_id and status = 'pending'
      and paddle_subscription_id is not null
  ) then
    return query select false, 'active_subscription'::text;
    return;
  end if;

  select * into v_attempt
  from public.billing_subscriptions
  where user_id = v_user_id and status = 'pending'
    and paddle_subscription_id is null
  for update;

  if found and v_attempt.updated_at > now() - interval '30 minutes' then
    return query select false, 'checkout_in_progress'::text;
    return;
  elsif found then
    update public.billing_subscriptions
    set plan = p_plan, billing_cycle = p_billing_cycle, updated_at = now()
    where id = v_attempt.id;
  else
    insert into public.billing_subscriptions (user_id, plan, billing_cycle, status, updated_at)
    values (v_user_id, p_plan, p_billing_cycle, 'pending', now());
  end if;

  return query select true, null::text;
end;
$$;

create or replace function public.release_paddle_checkout()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return false; end if;
  update public.billing_subscriptions
  set status = 'canceled', updated_at = now()
  where user_id = v_user_id and status = 'pending'
    and paddle_subscription_id is null;
  return found;
end;
$$;

create or replace function public.sync_paddle_subscription_event(
  p_user_id uuid,
  p_plan text,
  p_billing_cycle text,
  p_status text,
  p_paddle_customer_id text,
  p_paddle_subscription_id text,
  p_paddle_transaction_id text,
  p_price_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_event_occurred_at timestamptz,
  p_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted_id uuid;
begin
  if p_paddle_subscription_id is null or p_event_occurred_at is null or p_event_id is null then
    raise exception 'Paddle subscription ID and event ordering fields are required';
  end if;

  if p_user_id is not null and p_plan in ('starter', 'pro', 'unlimited')
      and p_billing_cycle in ('monthly', 'annual') then
    -- Convert the checkout reservation into the actual subscription row when possible.
    update public.billing_subscriptions
    set plan = p_plan,
        billing_cycle = p_billing_cycle,
        status = coalesce(p_status, 'pending'),
        paddle_customer_id = coalesce(p_paddle_customer_id, paddle_customer_id),
        paddle_subscription_id = p_paddle_subscription_id,
        paddle_transaction_id = coalesce(p_paddle_transaction_id, paddle_transaction_id),
        price_id = coalesce(p_price_id, price_id),
        current_period_start = coalesce(p_current_period_start, current_period_start),
        current_period_end = coalesce(p_current_period_end, current_period_end),
        cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end),
        canceled_at = coalesce(p_canceled_at, canceled_at),
        paddle_event_occurred_at = p_event_occurred_at,
        paddle_event_id = p_event_id,
        updated_at = now()
    where user_id = p_user_id and status = 'pending'
      and paddle_subscription_id is null;
    if found then return true; end if;

    insert into public.billing_subscriptions (
      user_id, plan, billing_cycle, status, paddle_customer_id,
      paddle_subscription_id, paddle_transaction_id, price_id,
      current_period_start, current_period_end, cancel_at_period_end,
      canceled_at, paddle_event_occurred_at, paddle_event_id, updated_at
    ) values (
      p_user_id, p_plan, p_billing_cycle, coalesce(p_status, 'pending'),
      p_paddle_customer_id, p_paddle_subscription_id, p_paddle_transaction_id,
      p_price_id, p_current_period_start, p_current_period_end,
      coalesce(p_cancel_at_period_end, false), p_canceled_at,
      p_event_occurred_at, p_event_id, now()
    )
    on conflict (paddle_subscription_id) do update set
      plan = excluded.plan,
      billing_cycle = excluded.billing_cycle,
      status = coalesce(p_status, public.billing_subscriptions.status),
      paddle_customer_id = coalesce(excluded.paddle_customer_id, public.billing_subscriptions.paddle_customer_id),
      paddle_transaction_id = coalesce(excluded.paddle_transaction_id, public.billing_subscriptions.paddle_transaction_id),
      price_id = coalesce(excluded.price_id, public.billing_subscriptions.price_id),
      current_period_start = coalesce(excluded.current_period_start, public.billing_subscriptions.current_period_start),
      current_period_end = coalesce(excluded.current_period_end, public.billing_subscriptions.current_period_end),
      cancel_at_period_end = coalesce(p_cancel_at_period_end, public.billing_subscriptions.cancel_at_period_end),
      canceled_at = coalesce(excluded.canceled_at, public.billing_subscriptions.canceled_at),
      paddle_event_occurred_at = excluded.paddle_event_occurred_at,
      paddle_event_id = excluded.paddle_event_id,
      updated_at = now()
    where public.billing_subscriptions.user_id = excluded.user_id
      and (public.billing_subscriptions.paddle_event_occurred_at is null
        or (public.billing_subscriptions.paddle_event_occurred_at, public.billing_subscriptions.paddle_event_id)
          < (excluded.paddle_event_occurred_at, excluded.paddle_event_id))
    returning id into v_inserted_id;

    return v_inserted_id is not null;
  end if;

  -- Events without enough custom_data may still update a known subscription,
  -- but can never create a row or change its owning Supabase user.
  update public.billing_subscriptions
  set status = coalesce(p_status, status),
      paddle_customer_id = coalesce(p_paddle_customer_id, paddle_customer_id),
      paddle_transaction_id = coalesce(p_paddle_transaction_id, paddle_transaction_id),
      price_id = coalesce(p_price_id, price_id),
      current_period_start = coalesce(p_current_period_start, current_period_start),
      current_period_end = coalesce(p_current_period_end, current_period_end),
      cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end),
      canceled_at = coalesce(p_canceled_at, canceled_at),
      paddle_event_occurred_at = p_event_occurred_at,
      paddle_event_id = p_event_id,
      updated_at = now()
  where paddle_subscription_id = p_paddle_subscription_id
    and (p_user_id is null or user_id = p_user_id)
    and (paddle_event_occurred_at is null
      or (paddle_event_occurred_at, paddle_event_id) < (p_event_occurred_at, p_event_id));
  return found;
end;
$$;

revoke all on function public.reserve_paddle_checkout(text, text) from public, anon;
grant execute on function public.reserve_paddle_checkout(text, text) to authenticated;
revoke all on function public.release_paddle_checkout() from public, anon;
grant execute on function public.release_paddle_checkout() to authenticated;
revoke all on function public.sync_paddle_subscription_event(uuid, text, text, text, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.sync_paddle_subscription_event(uuid, text, text, text, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, text) to service_role;
