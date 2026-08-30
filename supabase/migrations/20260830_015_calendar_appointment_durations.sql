alter table public.calendar_entries
  drop constraint if exists calendar_entries_shape_check;

alter table public.calendar_entries
  add constraint calendar_entries_shape_check check (
    (kind = 'event' and start_time is null and duration_minutes is null)
    or
    (
      kind = 'appointment'
      and start_time is not null
      and duration_minutes between 30 and 300
      and mod(duration_minutes, 30) = 0
    )
  );
