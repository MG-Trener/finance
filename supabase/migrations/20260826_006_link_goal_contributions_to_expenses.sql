alter table public.goal_contributions
  add column if not exists person_id uuid references public.people(id) on delete set null,
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create index if not exists goal_contributions_person_id_idx
  on public.goal_contributions(person_id, contributed_at desc);

create unique index if not exists goal_contributions_transaction_id_uidx
  on public.goal_contributions(transaction_id)
  where transaction_id is not null;

update public.goal_contributions gc
set person_id = p.id
from public.people p
where gc.person_id is null
  and p.family_id = gc.family_id
  and p.linked_user_id = gc.created_by;

insert into public.categories(type,name,icon,sort_order,is_system)
select 'expense'::public.transaction_type,'Цели и накопления','🎯',95,true
where not exists (
  select 1 from public.categories
  where family_id is null
    and type='expense'::public.transaction_type
    and name='Цели и накопления'
);

insert into public.categories(type,name,icon,sort_order,is_system)
select 'income'::public.transaction_type,'Цели и накопления','🎯',55,true
where not exists (
  select 1 from public.categories
  where family_id is null
    and type='income'::public.transaction_type
    and name='Цели и накопления'
);

create or replace function public.contribute_to_goal(
  p_goal_id uuid,
  p_amount numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_user uuid := auth.uid();
  v_goal public.financial_goals;
  v_person public.people;
  v_category public.categories;
  v_transaction public.transactions;
  v_contribution public.goal_contributions;
  v_type public.transaction_type;
  v_description text;
  v_at timestamptz := now();
begin
  if v_user is null then
    raise exception 'Требуется авторизация';
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception 'Сумма пополнения не может быть нулевой';
  end if;

  select * into v_goal
  from public.financial_goals
  where id = p_goal_id;

  if not found then
    raise exception 'Финансовая цель не найдена';
  end if;

  if not exists (
    select 1 from public.family_users fu
    where fu.family_id = v_goal.family_id and fu.user_id = v_user
  ) then
    raise exception 'Нет доступа к этой финансовой цели';
  end if;

  select * into v_person
  from public.people p
  where p.family_id = v_goal.family_id
    and p.linked_user_id = v_user
  limit 1;

  if not found then
    raise exception 'Ваш аккаунт не привязан к участнику семьи. Укажите связь пользователя с Мужем или Женой.';
  end if;

  v_type := case when p_amount > 0
    then 'expense'::public.transaction_type
    else 'income'::public.transaction_type
  end;

  select * into v_category
  from public.categories c
  where c.family_id is null
    and c.type = v_type
    and c.name = 'Цели и накопления'
  order by c.is_system desc, c.sort_order
  limit 1;

  if not found then
    raise exception 'Системная категория «Цели и накопления» не найдена';
  end if;

  v_description := case when p_amount > 0
    then 'Пополнение цели «' || v_goal.name || '»'
    else 'Возврат из цели «' || v_goal.name || '»'
  end;

  if nullif(btrim(p_note), '') is not null then
    v_description := v_description || ' · ' || btrim(p_note);
  end if;

  insert into public.transactions(
    family_id, person_id, type, amount, category_id, subcategory_id,
    description, occurred_at, created_by, updated_by, updated_at
  ) values (
    v_goal.family_id, v_person.id, v_type, abs(p_amount), v_category.id, null,
    v_description, v_at, v_user, v_user, v_at
  )
  returning * into v_transaction;

  insert into public.goal_contributions(
    goal_id, family_id, amount, note, contributed_at, created_by, person_id, transaction_id
  ) values (
    v_goal.id, v_goal.family_id, p_amount, nullif(btrim(p_note), ''), v_at, v_user, v_person.id, v_transaction.id
  )
  returning * into v_contribution;

  return jsonb_build_object(
    'contribution', to_jsonb(v_contribution),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

revoke all on function public.contribute_to_goal(uuid,numeric,text) from public;
grant execute on function public.contribute_to_goal(uuid,numeric,text) to authenticated;
