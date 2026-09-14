-- Wife calendar personal blocks share the same timed grid as salon appointments.
-- They have no client/phone/service/amount fields, but use title, start time,
-- duration and optional comment.

alter table public.calendar_entries
  drop constraint if exists calendar_entries_kind_check;

alter table public.calendar_entries
  add constraint calendar_entries_kind_check
  check (kind = any (array['event'::text, 'appointment'::text, 'personal'::text]));

alter table public.calendar_entries
  drop constraint if exists calendar_entries_shape_check;

alter table public.calendar_entries
  add constraint calendar_entries_shape_check
  check (
    (kind = 'event' and start_time is null and duration_minutes is null)
    or
    (kind in ('appointment','personal')
      and start_time is not null
      and duration_minutes >= 30
      and duration_minutes <= 300
      and mod(duration_minutes,30) = 0)
  );

create or replace function public.prevent_calendar_timed_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind not in ('appointment','personal') then
    return new;
  end if;

  if exists (
    select 1
    from public.calendar_entries e
    where e.person_id = new.person_id
      and e.entry_date = new.entry_date
      and e.kind in ('appointment','personal')
      and e.id <> new.id
      and new.start_time < e.start_time + make_interval(mins => e.duration_minutes)
      and e.start_time < new.start_time + make_interval(mins => new.duration_minutes)
  ) then
    raise exception using
      errcode = '23P01',
      message = 'CALENDAR_TIME_OVERLAP';
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_entries_prevent_timed_overlap on public.calendar_entries;
create trigger calendar_entries_prevent_timed_overlap
before insert or update of person_id, entry_date, kind, start_time, duration_minutes
on public.calendar_entries
for each row
execute function public.prevent_calendar_timed_overlap();
