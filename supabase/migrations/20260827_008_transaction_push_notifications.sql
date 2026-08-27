create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_devices_family_enabled_idx on public.push_devices(family_id, enabled);
create index if not exists push_devices_user_idx on public.push_devices(user_id);
alter table public.push_devices enable row level security;

drop policy if exists push_devices_select_own on public.push_devices;
create policy push_devices_select_own on public.push_devices for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists push_devices_update_own on public.push_devices;
create policy push_devices_update_own on public.push_devices for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  event_type text not null check (event_type in ('insert','update','delete','restore')),
  actor_user_id uuid references auth.users(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  delivery_status text,
  delivery_error text,
  attempts integer not null default 0
);

create index if not exists push_outbox_pending_idx on public.push_outbox(family_id, created_at) where delivered_at is null;
alter table public.push_outbox enable row level security;

create or replace function public.register_push_device(p_token text, p_platform text default 'android')
returns public.push_devices language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_family uuid; v_row public.push_devices;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_token is null or length(btrim(p_token)) < 20 then raise exception 'INVALID_PUSH_TOKEN'; end if;
  select fu.family_id into v_family from public.family_users fu where fu.user_id=v_uid limit 1;
  if v_family is null then raise exception 'NO_FAMILY_ACCESS'; end if;
  insert into public.push_devices(family_id,user_id,token,platform,enabled,last_seen_at,updated_at)
  values(v_family,v_uid,btrim(p_token),coalesce(nullif(btrim(p_platform),''),'android'),true,now(),now())
  on conflict(token) do update set family_id=excluded.family_id,user_id=excluded.user_id,platform=excluded.platform,enabled=true,last_seen_at=now(),updated_at=now()
  returning * into v_row;
  return v_row;
end;$$;
grant execute on function public.register_push_device(text,text) to authenticated;

create or replace function public.set_push_device_enabled(p_token text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.push_devices set enabled=coalesce(p_enabled,false),updated_at=now(),last_seen_at=now() where token=btrim(p_token) and user_id=v_uid;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;$$;
grant execute on function public.set_push_device_enabled(text,boolean) to authenticated;

create or replace function private.enqueue_transaction_push_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_event text; v_actor uuid;
begin
  if tg_op='INSERT' then v_event:='insert';v_actor:=new.created_by;
  else
    if old.deleted_at is null and new.deleted_at is not null then v_event:='delete';v_actor:=coalesce(new.deleted_by,new.updated_by);
    elsif old.deleted_at is not null and new.deleted_at is null then v_event:='restore';v_actor:=new.updated_by;
    elsif row(old.person_id,old.type,old.amount,old.category_id,old.subcategory_id,old.description,old.occurred_at)
       is not distinct from row(new.person_id,new.type,new.amount,new.category_id,new.subcategory_id,new.description,new.occurred_at) then return new;
    else v_event:='update';v_actor:=new.updated_by;
    end if;
  end if;
  insert into public.push_outbox(family_id,transaction_id,event_type,actor_user_id,before_data,after_data)
  values(new.family_id,new.id,v_event,v_actor,case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  return new;
end;$$;

drop trigger if exists transactions_push_outbox on public.transactions;
create trigger transactions_push_outbox after insert or update on public.transactions for each row execute function private.enqueue_transaction_push_event();

revoke all on public.push_outbox from anon, authenticated;
grant select, update on public.push_devices to authenticated;
