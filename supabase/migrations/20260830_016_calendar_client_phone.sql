alter table public.calendar_entries
  add column if not exists client_phone text null;

comment on column public.calendar_entries.client_phone is
  'Optional client phone number for salon appointments. Used to open the device dialer via tel: links.';
