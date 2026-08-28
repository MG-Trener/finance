insert into public.subcategories(category_id,name,sort_order,person_label)
select c.id, 'Бытовая химия', 50, null
from public.categories c
where c.type='expense'
  and c.name='Продукты'
  and c.family_id is null
  and not exists (
    select 1
    from public.subcategories s
    where s.category_id=c.id
      and s.name='Бытовая химия'
  );
