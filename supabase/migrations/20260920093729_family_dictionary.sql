alter table public.wife_dictionary
  add column if not exists dictionary_owner text not null default 'wife',
  add column if not exists comment text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wife_dictionary_owner_check'
      and conrelid = 'public.wife_dictionary'::regclass
  ) then
    alter table public.wife_dictionary
      add constraint wife_dictionary_owner_check
      check (dictionary_owner in ('wife','husband'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'wife_dictionary_comment_length_check'
      and conrelid = 'public.wife_dictionary'::regclass
  ) then
    alter table public.wife_dictionary
      add constraint wife_dictionary_comment_length_check
      check (comment is null or char_length(comment) <= 500);
  end if;
end $$;

drop index if exists public.wife_dictionary_family_alias_unique_idx;

create unique index if not exists wife_dictionary_family_owner_alias_unique_idx
  on public.wife_dictionary(family_id, dictionary_owner, lower(btrim(alias)));

create index if not exists wife_dictionary_family_owner_created_idx
  on public.wife_dictionary(family_id, dictionary_owner, created_at desc);

grant update (alias, comment) on table public.wife_dictionary to authenticated;
