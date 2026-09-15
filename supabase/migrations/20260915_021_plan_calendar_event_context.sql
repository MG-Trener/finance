alter table public.calendar_entries
  add column if not exists calendar_context text not null default 'work',
  add column if not exists event_type text;

update public.calendar_entries
set calendar_context='work'
where calendar_context is null or calendar_context='';

alter table public.calendar_entries drop constraint if exists calendar_entries_context_check;
alter table public.calendar_entries
  add constraint calendar_entries_context_check
  check (calendar_context in ('work','plan'));

alter table public.calendar_entries drop constraint if exists calendar_entries_event_type_check;
alter table public.calendar_entries
  add constraint calendar_entries_event_type_check
  check (event_type is null or event_type in ('birthday','meeting'));

create index if not exists calendar_entries_family_context_date_idx
  on public.calendar_entries(family_id, calendar_context, entry_date);
