# Refactor structure

Это переходная структура для отказа от временных `phase*.js` и `phase*.css` без риска сломать рабочую GitHub Pages версию.

## Целевая структура

- `src/js/core/` — Supabase, состояние, общие утилиты, загрузка данных;
- `src/js/features/` — функциональные модули: обзор, журнал, бюджеты, регулярные платежи, доступ, экспорт;
- `src/js/ui/` — навигация, фокус, подсказки, графические декораторы;
- `src/css/app.css` — единая точка входа стилей;
- `src/css/components/` — стили отдельных компонентов;
- `src/css/pages/` — стили страниц;
- `assets/` — изображения и UI-графика.

## Уже перенесено

### JavaScript

- `src/js/features/access-overview.js` — быстрый доступ к приглашению жены из Обзора;
- `src/js/features/private-access.js` — закрытая семейная авторизация и приглашения;
- `src/js/features/date-ribbon.js` — пиратская лента дат;
- `src/js/features/ui-enhancements.js` — подсказки, текущая дата и drag-логика;
- `src/js/ui/pirate-assets.js` — декорирование динамических кнопок и статусов;
- `src/js/ui/pirate-navigation.js` — пиратская навигация и индикатор регулярных платежей;
- `src/js/ui/focus-management.js` — автофокус поля суммы на Обзоре.

### CSS

- `src/css/app.css` — единая точка подключения CSS;
- `src/css/components/access-overview.css`;
- `src/css/components/private-access.css`;
- `src/css/components/date-ribbon.css`;
- `src/css/components/ui-enhancements.css`;
- `src/css/components/pirate-assets.css`;
- `src/css/components/pirate-navigation.css`;
- `src/css/components/pirate-transaction-controls.css`;
- `src/css/components/compact-actions-recurring.css`.

## Больше не используются напрямую в рабочем `index.html`

- `phase5.js`;
- `phase6.js`;
- `phase8.js`;
- `phase10.js`;
- `phase11.js`;
- `phase12.js`;
- `phase13.js`.

## Больше не используются активным CSS bundle

- `phase6.css`;
- `phase7.css`;
- `phase8.css`;
- `phase9.css`;
- `phase10.css`;
- `phase11.css`;
- `phase12.css`;
- `phase13.css`.

Старые файлы пока остаются в репозитории как резерв до завершения проверки новой структуры.

## Осталось перенести

1. `phase3.js/css` — Обзор, форма операции, компактная сводка и регулярные платежи.
2. `phase4.js/css` — Журнал операций.
3. `phase2-fix.js` — исправления переключения типа операции и редактирования.
4. Разделить большой `app.js`: `core/supabase.js`, `core/state.js`, `core/data.js`, общие CRUD-операции и страницы.
5. После проверки удалить старые `phase*.js/css` и неиспользуемые файлы Next.js/Prisma/Docker.
