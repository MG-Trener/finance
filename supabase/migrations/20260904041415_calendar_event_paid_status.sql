alter table public.calendar_entries
  add column if not exists is_paid boolean not null default false;

comment on column public.calendar_entries.is_paid is
  'Payment status for husband calendar events; false for unpaid/new entries.';
