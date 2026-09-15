do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='family-birthday-push-daily' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  -- 19:05 UTC = 00:05 in Kazakhstan (UTC+5): send as the birthday date begins.
  perform cron.schedule(
    'family-birthday-push-daily',
    '5 19 * * *',
    $cmd$
      select net.http_post(
        url := 'https://llgubwtuhxpdpxaxxcft.supabase.co/functions/v1/birthday-push-dispatch',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-birthday-cron',(select secret_value from public.internal_scheduler_secrets where key='birthday_push_cron')
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
end $$;