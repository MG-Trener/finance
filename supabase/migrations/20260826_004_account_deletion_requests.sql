create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  reason text,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists account_deletion_requests_one_pending_per_user
  on public.account_deletion_requests(user_id)
  where status='pending';

create index if not exists account_deletion_requests_family_idx
  on public.account_deletion_requests(family_id, requested_at desc);

alter table public.account_deletion_requests enable row level security;

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own
on public.account_deletion_requests
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists account_deletion_requests_insert_own on public.account_deletion_requests;
create policy account_deletion_requests_insert_own
on public.account_deletion_requests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.family_users fu
    where fu.user_id = (select auth.uid())
      and fu.family_id = account_deletion_requests.family_id
  )
);

revoke all on table public.account_deletion_requests from anon;
revoke all on table public.account_deletion_requests from public;
grant select, insert on table public.account_deletion_requests to authenticated;
