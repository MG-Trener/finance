create or replace function public.purge_family_transaction(p_transaction_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_family_id uuid;
  v_deleted_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Требуется авторизация';
  end if;

  select t.family_id, t.deleted_at
    into v_family_id, v_deleted_at
  from public.transactions t
  where t.id = p_transaction_id
  for update;

  if not found then
    return false;
  end if;

  if not private.is_family_member(v_family_id) then
    raise exception 'Нет доступа к этой операции';
  end if;

  if v_deleted_at is null then
    raise exception 'Окончательно удалить можно только операцию из корзины';
  end if;

  delete from public.transaction_history
  where transaction_id = p_transaction_id;

  delete from public.transactions
  where id = p_transaction_id;

  return true;
end;
$$;

create or replace function public.purge_family_trash(p_family_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Требуется авторизация';
  end if;

  if not private.is_family_member(p_family_id) then
    raise exception 'Нет доступа к этой семье';
  end if;

  delete from public.transaction_history h
  using public.transactions t
  where h.transaction_id = t.id
    and t.family_id = p_family_id
    and t.deleted_at is not null;

  delete from public.transactions t
  where t.family_id = p_family_id
    and t.deleted_at is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_family_transaction(uuid) from public;
revoke all on function public.purge_family_trash(uuid) from public;
grant execute on function public.purge_family_transaction(uuid) to authenticated;
grant execute on function public.purge_family_trash(uuid) to authenticated;
