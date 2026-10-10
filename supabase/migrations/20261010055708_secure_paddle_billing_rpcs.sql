-- Only the server-side service role can call the checkout reservation and webhook sync RPCs.
-- Checkout authenticates the caller before using its private service-role client.
revoke all on function public.reserve_paddle_checkout(text, text) from public, anon, authenticated;
revoke all on function public.release_paddle_checkout() from public, anon, authenticated;

create or replace function public.reserve_paddle_checkout(
  p_user_id uuid,
  p_plan text,
  p_billing_cycle text
)
returns table (reserved boolean, reason text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_attempt public.billing_subscriptions%rowtype;
begin
  if p_user_id is null then
    return query select false, 'unauthenticated'::text;
    return;
  end if;
  if p_plan not in ('starter', 'pro', 'unlimited') or p_billing_cycle not in ('monthly', 'annual') then
    return query select false, 'invalid_plan'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if exists (
    select 1 from public.billing_subscriptions
    where user_id = p_user_id and status in ('active', 'trialing', 'past_due', 'paused')
  ) then
    return query select false, 'active_subscription'::text;
    return;
  end if;
  if exists (
    select 1 from public.billing_subscriptions
    where user_id = p_user_id and status = 'pending' and paddle_subscription_id is not null
  ) then
    return query select false, 'active_subscription'::text;
    return;
  end if;

  select * into v_attempt
  from public.billing_subscriptions
  where user_id = p_user_id and status = 'pending' and paddle_subscription_id is null
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
    values (p_user_id, p_plan, p_billing_cycle, 'pending', now());
  end if;

  return query select true, null::text;
end;
$$;

create or replace function public.release_paddle_checkout(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then return false; end if;
  update public.billing_subscriptions
  set status = 'canceled', updated_at = now()
  where user_id = p_user_id and status = 'pending' and paddle_subscription_id is null;
  return found;
end;
$$;

alter function public.sync_paddle_subscription_event(
  uuid, text, text, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, timestamptz, text
) security invoker;

revoke all on function public.reserve_paddle_checkout(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_paddle_checkout(uuid, text, text) to service_role;
revoke all on function public.release_paddle_checkout(uuid) from public, anon, authenticated;
grant execute on function public.release_paddle_checkout(uuid) to service_role;
revoke all on function public.sync_paddle_subscription_event(
  uuid, text, text, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.sync_paddle_subscription_event(
  uuid, text, text, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, timestamptz, text
) to service_role;
