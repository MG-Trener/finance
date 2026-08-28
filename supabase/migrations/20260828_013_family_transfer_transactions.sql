alter table public.transactions alter column category_id drop not null;

alter table public.transactions
  add column if not exists transfer_to_person_id uuid null references public.people(id) on delete restrict;

alter table public.transactions drop constraint if exists transactions_transfer_shape_check;
alter table public.transactions
  add constraint transactions_transfer_shape_check check (
    (
      type::text = 'transfer'
      and transfer_to_person_id is not null
      and transfer_to_person_id <> person_id
      and category_id is null
      and subcategory_id is null
    )
    or
    (
      type::text <> 'transfer'
      and transfer_to_person_id is null
      and category_id is not null
    )
  );

create or replace function private.validate_transaction_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if tg_op = 'UPDATE' then
    new.family_id := old.family_id;
    new.created_by := old.created_by;
    new.updated_by := v_uid;
    new.updated_at := now();

    if old.deleted_at is null and new.deleted_at is not null then
      new.deleted_by := v_uid;
    elsif old.deleted_at is not null and new.deleted_at is null then
      new.deleted_by := null;
    end if;
  else
    new.created_by := coalesce(new.created_by, v_uid);
    new.updated_by := coalesce(new.updated_by, v_uid);
    new.updated_at := coalesce(new.updated_at, now());
  end if;

  if not (select private.is_family_member(new.family_id)) then
    raise exception 'NO_FAMILY_ACCESS';
  end if;

  if not exists (
    select 1 from public.people p
    where p.id = new.person_id and p.family_id = new.family_id
  ) then
    raise exception 'INVALID_PERSON';
  end if;

  if new.type::text = 'transfer' then
    if new.transfer_to_person_id is null or new.transfer_to_person_id = new.person_id then
      raise exception 'INVALID_TRANSFER_TARGET';
    end if;

    if not exists (
      select 1 from public.people p
      where p.id = new.transfer_to_person_id and p.family_id = new.family_id
    ) then
      raise exception 'INVALID_TRANSFER_TARGET';
    end if;

    new.category_id := null;
    new.subcategory_id := null;
    return new;
  end if;

  new.transfer_to_person_id := null;

  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id
      and c.type = new.type
      and (c.family_id is null or c.family_id = new.family_id)
  ) then
    raise exception 'INVALID_CATEGORY';
  end if;

  if new.subcategory_id is not null and not exists (
    select 1
    from public.subcategories s
    join public.people p on p.id = new.person_id and p.family_id = new.family_id
    where s.id = new.subcategory_id
      and s.category_id = new.category_id
      and (s.person_label is null or s.person_label = p.label)
  ) then
    raise exception 'INVALID_SUBCATEGORY';
  end if;

  return new;
end;
$function$;

create or replace function public.create_family_transfer(
  p_family_id uuid,
  p_from_person_id uuid,
  p_to_person_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default now()
)
returns public.transactions
language plpgsql
set search_path = 'public', 'auth', 'private'
as $function$
declare
  v_user uuid := auth.uid();
  v_row public.transactions;
begin
  if v_user is null then
    raise exception 'Требуется авторизация';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Сумма должна быть больше нуля';
  end if;

  if p_from_person_id is null or p_to_person_id is null or p_from_person_id = p_to_person_id then
    raise exception 'Выберите разных участников перевода';
  end if;

  if not exists (
    select 1 from public.family_users fu
    where fu.family_id = p_family_id and fu.user_id = v_user
  ) then
    raise exception 'Нет доступа к этой семье';
  end if;

  if not exists (
    select 1 from public.people p
    where p.id = p_from_person_id and p.family_id = p_family_id
  ) or not exists (
    select 1 from public.people p
    where p.id = p_to_person_id and p.family_id = p_family_id
  ) then
    raise exception 'Участник не относится к этой семье';
  end if;

  insert into public.transactions(
    family_id, person_id, transfer_to_person_id, type, amount,
    category_id, subcategory_id, description, occurred_at, created_by, updated_at
  ) values (
    p_family_id, p_from_person_id, p_to_person_id, 'transfer'::public.transaction_type, p_amount,
    null, null, nullif(btrim(p_description), ''), coalesce(p_occurred_at, now()), v_user, now()
  )
  returning * into v_row;

  return v_row;
end;
$function$;
