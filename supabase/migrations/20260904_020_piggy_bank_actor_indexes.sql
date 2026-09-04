create index if not exists piggy_bank_balances_created_by_idx
  on public.piggy_bank_balances(created_by);

create index if not exists piggy_bank_balances_updated_by_idx
  on public.piggy_bank_balances(updated_by);
