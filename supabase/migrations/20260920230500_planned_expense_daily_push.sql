create table if not exists public.planned_expense_push_deliveries (
  recurring_payment_id uuid not null references public.recurring_payments(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  due_date date not null,
  occurrence_date date not null,
  sent_at timestamptz not null default now(),
  sent_devices integer not null default 0,
  primary key (recurring_payment_id, due_date, occurrence_date)
);

alter table public.planned_expense_push_deliveries enable row level security;
revoke all on table public.planned_expense_push_deliveries from anon, authenticated;

insert into public.internal_scheduler_secrets(key,secret_value)
values ('planned_expense_push_cron',gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (key) do nothing;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='planned-expense-push-daily'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  -- 04:00 UTC = 09:00 in Kazakhstan (UTC+5).
  perform cron.schedule(
    'planned-expense-push-daily',
    '0 4 * * *',
    $cmd$
      select net.http_post(
        url := 'https://llgubwtuhxpdpxaxxcft.supabase.co/functions/v1/planned-expense-push-dispatch',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-planned-expense-cron',(select secret_value from public.internal_scheduler_secrets where key='planned_expense_push_cron')
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
end $$;
