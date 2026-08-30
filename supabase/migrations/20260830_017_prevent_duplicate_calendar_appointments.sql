-- A salon specialist can have only one appointment starting in the same
-- 30-minute slot. Older duplicate rows could remain after accidental double
-- submission and make released time look occupied after editing.
with ranked as (
  select id,
         row_number() over (
           partition by person_id, entry_date, start_time
           order by updated_at desc nulls last, created_at desc, id desc
         ) as rn
  from public.calendar_entries
  where kind = 'appointment'
)
delete from public.calendar_entries c
using ranked r
where c.id = r.id
  and r.rn > 1;

create unique index if not exists calendar_entries_unique_appointment_slot_idx
  on public.calendar_entries(person_id, entry_date, start_time)
  where kind = 'appointment' and start_time is not null;
