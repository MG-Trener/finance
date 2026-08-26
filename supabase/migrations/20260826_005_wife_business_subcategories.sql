alter table public.subcategories
  add column if not exists person_label text null;

alter table public.subcategories
  drop constraint if exists subcategories_person_label_check;

alter table public.subcategories
  add constraint subcategories_person_label_check
  check (person_label is null or person_label in ('husband','wife'));

insert into public.subcategories(category_id,name,sort_order,person_label)
select c.id, v.name, v.sort_order, 'wife'
from public.categories c
cross join (values
  ('HairStyle'::text, 40),
  ('UGC'::text, 50),
  ('Astrology'::text, 60)
) as v(name,sort_order)
where c.type='income' and c.name='Бизнес' and c.family_id is null
  and not exists (
    select 1 from public.subcategories s
    where s.category_id=c.id and s.name=v.name
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
