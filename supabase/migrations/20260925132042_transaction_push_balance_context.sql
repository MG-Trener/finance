create or replace function private.enqueue_transaction_push_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_actor uuid;
  v_after_data jsonb;
  v_balance_before numeric;
  v_balance_after numeric;
  v_delta numeric;
  v_month_key text;
begin
  if tg_op = 'INSERT' then
    v_event := 'insert';
    v_actor := new.created_by;
  else
    if old.deleted_at is null and new.deleted_at is not null then
      v_event := 'delete';
      v_actor := coalesce(new.deleted_by,new.updated_by);
    elsif old.deleted_at is not null and new.deleted_at is null then
      v_event := 'restore';
      v_actor := new.updated_by;
    elsif row(old.person_id,old.type,old.amount,old.category_id,old.subcategory_id,old.description,old.occurred_at)
       is not distinct from
          row(new.person_id,new.type,new.amount,new.category_id,new.subcategory_id,new.description,new.occurred_at) then
      return new;
    else
      v_event := 'update';
      v_actor := new.updated_by;
    end if;
  end if;

  v_after_data := to_jsonb(new);

  if tg_op = 'INSERT'
     and new.deleted_at is null
     and new.type in ('income','expense') then
    v_month_key := pg_catalog.to_char(new.occurred_at at time zone 'Asia/Almaty','YYYY-MM');

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.family_id::text || ':' || v_month_key, 0)
    );

    select coalesce(sum(
      case
        when t.type = 'income' then t.amount
        when t.type = 'expense' then -t.amount
        else 0
      end
    ),0)
    into v_balance_after
    from public.transactions t
    where t.family_id = new.family_id
      and t.deleted_at is null
      and pg_catalog.to_char(t.occurred_at at time zone 'Asia/Almaty','YYYY-MM') = v_month_key;

    v_delta := case
      when new.type = 'income' then new.amount
      when new.type = 'expense' then -new.amount
      else 0
    end;
    v_balance_before := v_balance_after - v_delta;

    v_after_data := v_after_data || pg_catalog.jsonb_build_object(
      '_family_balance_before', v_balance_before,
      '_family_balance_after', v_balance_after
    );
  end if;

  insert into public.push_outbox(
    family_id,transaction_id,event_type,actor_user_id,before_data,after_data
  )
  values(
    new.family_id,
    new.id,
    v_event,
    v_actor,
    case when tg_op='INSERT' then null else to_jsonb(old) end,
    v_after_data
  );
  return new;
end;
$$;
