create table if not exists public.wife_dictionary (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  alias text not null check (char_length(btrim(alias)) between 1 and 120),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists wife_dictionary_family_created_idx
  on public.wife_dictionary(family_id, created_at desc);

create unique index if not exists wife_dictionary_family_alias_unique_idx
  on public.wife_dictionary(family_id, lower(btrim(alias)));

alter table public.wife_dictionary enable row level security;

revoke all on table public.wife_dictionary from anon;
revoke all on table public.wife_dictionary from authenticated;
grant select, insert, delete on table public.wife_dictionary to authenticated;
grant all on table public.wife_dictionary to service_role;

drop policy if exists wife_dictionary_select_family on public.wife_dictionary;
create policy wife_dictionary_select_family
on public.wife_dictionary
for select
to authenticated
using ((select private.is_family_member(family_id)));

drop policy if exists wife_dictionary_insert_family on public.wife_dictionary;
create policy wife_dictionary_insert_family
on public.wife_dictionary
for insert
to authenticated
with check (
  (select private.is_family_member(family_id))
  and created_by = (select auth.uid())
);

drop policy if exists wife_dictionary_delete_family on public.wife_dictionary;
create policy wife_dictionary_delete_family
on public.wife_dictionary
for delete
to authenticated
using ((select private.is_family_member(family_id)));
