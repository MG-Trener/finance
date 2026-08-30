create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  kind text not null check (kind in ('event','appointment')),
  entry_date date not null,
  start_time time null,
  duration_minutes integer null,
  title text not null default '',
  client_name text null,
  service_name text null,
  amount numeric(14,2) null check (amount is null or amount >= 0),
  comment text null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_entries_shape_check check (
    (kind = 'event' and start_time is null and duration_minutes is null)
    or
    (kind = 'appointment' and start_time is not null and duration_minutes in (30,60))
  )
);

create index if not exists calendar_entries_family_person_date_idx
  on public.calendar_entries(family_id, person_id, entry_date);

create index if not exists calendar_entries_appointment_time_idx
  on public.calendar_entries(person_id, entry_date, start_time)
  where kind = 'appointment';

alter table public.calendar_entries enable row level security;

revoke all on table public.calendar_entries from anon;
grant select, insert, update, delete on table public.calendar_entries to authenticated;
grant all on table public.calendar_entries to service_role;

drop policy if exists calendar_entries_select_family on public.calendar_entries;
create policy calendar_entries_select_family
on public.calendar_entries
for select
to authenticated
using ((select private.is_family_member(family_id)));

drop policy if exists calendar_entries_insert_family on public.calendar_entries;
create policy calendar_entries_insert_family
on public.calendar_entries
for insert
to authenticated
with check (
  (select private.is_family_member(family_id))
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.people p
    where p.id = person_id
      and p.family_id = family_id
  )
);

drop policy if exists calendar_entries_update_family on public.calendar_entries;
create policy calendar_entries_update_family
on public.calendar_entries
for update
to authenticated
using ((select private.is_family_member(family_id)))
with check (
  (select private.is_family_member(family_id))
  and exists (
    select 1
    from public.people p
    where p.id = person_id
      and p.family_id = family_id
  )
);

drop policy if exists calendar_entries_delete_family on public.calendar_entries;
create policy calendar_entries_delete_family
on public.calendar_entries
for delete
to authenticated
using ((select private.is_family_member(family_id)));
