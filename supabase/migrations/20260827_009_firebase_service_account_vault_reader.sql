create or replace function public.get_firebase_service_account_json()
returns text
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'firebase_service_account_json'
  order by created_at desc
  limit 1;
$$;

revoke all on function public.get_firebase_service_account_json() from public;
revoke all on function public.get_firebase_service_account_json() from anon;
revoke all on function public.get_firebase_service_account_json() from authenticated;
grant execute on function public.get_firebase_service_account_json() to service_role;
