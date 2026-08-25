# Refactor structure

Это переходная структура для отказа от временных `phase*.js` и `phase*.css` без риска сломать рабочую GitHub Pages версию.

## Целевая структура

- `src/js/core/` — Supabase, состояние, общие утилиты, загрузка данных;
- `src/js/features/` — функциональные модули: обзор, журнал, бюджеты, регулярные платежи, доступ, экспорт;
- `src/js/ui/` — навигация, модальные окна, подсказки, графические декораторы;
- `src/css/app.css` — единая точка входа стилей;
- `src/css/components/` — стили отдельных компонентов;
- `src/css/pages/` — стили страниц;
- `assets/` — изображения и UI-графика.

## Уже перенесено

- `src/css/app.css` — единая точка подключения CSS;
- `src/js/features/access-overview.js` — быстрый доступ к приглашению жены из Обзора;
- `src/js/features/private-access.js` — закрытая семейная авторизация и приглашения;
- `src/js/features/date-ribbon.js` — пиратская лента дат;
- `src/js/features/ui-enhancements.js` — подсказки, текущая дата, drag-логика;
- `src/js/ui/pirate-assets.js` — декорирование динамических кнопок и статусов графическими ассетами;
- `src/css/components/access-overview.css`;
- `src/css/components/private-access.css`;
- `src/css/components/date-ribbon.css`;
- `src/css/components/ui-enhancements.css`;
- `src/css/components/pirate-assets.css`.

## Больше не используются напрямую в рабочем `index.html`

- `phase8.js`;
- `phase10.js`;
- `phase11.js`;
- `phase12.js`;
- `phase13.js`.

Старые файлы пока остаются в репозитории как резерв до завершения проверки новой структуры.

## Следующие шаги

1. Перенести `phase6.js/css` — навигацию и пиратский UI-каркас.
2. Перенести `phase3.js/css` — Обзор, форму операции и регулярные платежи.
3. Перенести `phase4.js/css` — Журнал.
4. Разделить большой `app.js`: `core/supabase.js`, `core/state.js`, `core/data.js`, общие CRUD-операции.
5. Перенести бюджеты и аналитику в отдельные feature-модули.
6. После проверки удалить старые `phase*.js/css` и неиспользуемые файлы Next.js/Prisma/Docker.
