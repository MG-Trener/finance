grant update (alias) on table public.wife_dictionary to authenticated;

drop policy if exists wife_dictionary_update_family on public.wife_dictionary;
create policy wife_dictionary_update_family
on public.wife_dictionary
for update
to authenticated
using ((select private.is_family_member(family_id)))
with check ((select private.is_family_member(family_id)));
