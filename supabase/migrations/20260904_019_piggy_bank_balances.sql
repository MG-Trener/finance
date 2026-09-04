create table if not exists public.piggy_bank_balances (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  currency_code text not null check (currency_code in ('KZT','RUB','USD','CNY')),
  amount numeric(20,2) not null default 0 check (amount >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint piggy_bank_balances_family_currency_key unique (family_id, currency_code)
);

create index if not exists piggy_bank_balances_family_idx
  on public.piggy_bank_balances(family_id);

alter table public.piggy_bank_balances enable row level security;

revoke all on table public.piggy_bank_balances from anon;
revoke all on table public.piggy_bank_balances from authenticated;
grant select, insert, update on table public.piggy_bank_balances to authenticated;
grant all on table public.piggy_bank_balances to service_role;

drop policy if exists piggy_bank_select_family on public.piggy_bank_balances;
create policy piggy_bank_select_family
on public.piggy_bank_balances
for select
to authenticated
using ((select private.is_family_member(family_id)));

drop policy if exists piggy_bank_insert_family on public.piggy_bank_balances;
create policy piggy_bank_insert_family
on public.piggy_bank_balances
for insert
to authenticated
with check (
  (select private.is_family_member(family_id))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists piggy_bank_update_family on public.piggy_bank_balances;
create policy piggy_bank_update_family
on public.piggy_bank_balances
for update
to authenticated
using ((select private.is_family_member(family_id)))
with check (
  (select private.is_family_member(family_id))
  and updated_by = (select auth.uid())
);

create or replace function public.add_piggy_bank_amount(
  p_family_id uuid,
  p_currency_code text,
  p_amount numeric
)
returns public.piggy_bank_balances
language plpgsql
security invoker
set search_path = public, auth, private, pg_temp
as $$
declare
  result public.piggy_bank_balances;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Сумма пополнения должна быть больше нуля' using errcode = '22023';
  end if;
  if p_currency_code not in ('KZT','RUB','USD','CNY') then
    raise exception 'Неподдерживаемая валюта' using errcode = '22023';
  end if;

  insert into public.piggy_bank_balances (
    family_id, currency_code, amount, created_by, updated_by
  ) values (
    p_family_id, p_currency_code, round(p_amount, 2), auth.uid(), auth.uid()
  )
  on conflict (family_id, currency_code) do update
    set amount = public.piggy_bank_balances.amount + excluded.amount,
        updated_by = auth.uid(),
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.add_piggy_bank_amount(uuid, text, numeric) from public, anon;
grant execute on function public.add_piggy_bank_amount(uuid, text, numeric) to authenticated, service_role;
