create or replace function private.protect_linked_goal_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if exists (
    select 1
    from public.goal_contributions gc
    where gc.transaction_id = old.id
  ) then
    raise exception 'Операция создана пополнением финансовой цели и изменяется только через раздел «Цели»';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.protect_linked_goal_transaction() from public;

create trigger transactions_protect_goal_link
before update or delete on public.transactions
for each row execute function private.protect_linked_goal_transaction();
