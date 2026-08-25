# Refactor structure

Проект постепенно переводится с временных `phase*.js` / `phase*.css` на постоянную структуру без изменения поведения рабочей GitHub Pages версии.

## Целевая структура

- `src/js/core/` — состояние, Supabase, загрузка данных, общая логика форм и CRUD;
- `src/js/features/` — функциональные модули: Обзор, Журнал, регулярные платежи, доступ, экспорт и т.д.;
- `src/js/ui/` — навигация, фокус, подсказки, графические декораторы;
- `src/css/app.css` — единая точка входа стилей;
- `src/css/components/` — стили компонентов;
- `src/css/pages/` — стили отдельных страниц;
- `assets/` — изображения и UI-графика.

## Уже перенесено

### JavaScript

- `src/js/core/transaction-form.js` — базовая логика формы операции;
- `src/js/features/reminders.js` — расчёт сроков и ближайших регулярных платежей;
- `src/js/features/transaction-entry.js` — быстрый ввод операции и недавние категории;
- `src/js/features/overview.js` — Обзор и семейная сводка;
- `src/js/features/recurring.js` — страница регулярных платежей;
- `src/js/features/journal.js` — Журнал операций;
- `src/js/features/access-overview.js` — быстрый доступ к приглашению супруги из Обзора;
- `src/js/features/private-access.js` — закрытая семейная авторизация и приглашения;
- `src/js/features/date-ribbon.js` — пиратская лента дат;
- `src/js/features/ui-enhancements.js` — подсказки, текущая дата и drag-логика;
- `src/js/ui/pirate-assets.js` — декорирование динамических кнопок и статусов;
- `src/js/ui/pirate-navigation.js` — пиратская навигация и индикатор регулярных платежей;
- `src/js/ui/focus-management.js` — автофокус суммы.

### CSS

- `src/css/app.css` — единая точка подключения CSS;
- `src/css/pages/overview.css`;
- `src/css/pages/recurring.css`;
- `src/css/pages/journal.css`;
- `src/css/components/transaction-entry.css`;
- `src/css/components/reminders.css`;
- `src/css/components/access-overview.css`;
- `src/css/components/private-access.css`;
- `src/css/components/date-ribbon.css`;
- `src/css/components/ui-enhancements.css`;
- `src/css/components/pirate-assets.css`;
- `src/css/components/pirate-navigation.css`;
- `src/css/components/pirate-transaction-controls.css`;
- `src/css/components/compact-actions-recurring.css`.

## Статус временных phase-файлов

В активном `index.html` больше не используются `phase2-fix.js`, `phase3.js`, `phase4.js`, `phase5.js`, `phase6.js`, `phase8.js`, `phase10.js`, `phase11.js`, `phase12.js`, `phase13.js`.

В активном CSS bundle больше не используются `phase3.css`, `phase4.css`, `phase6.css`, `phase7.css`, `phase8.css`, `phase9.css`, `phase10.css`, `phase11.css`, `phase12.css`, `phase13.css`.

Старые файлы пока оставлены в корне репозитория как резерв до финальной проверки.

## Следующий этап

1. Разделить большой `app.js` на `src/js/core/` и feature-модули.
2. Перенести базовую авторизацию, состояние и загрузку данных из `app.js`.
3. Вынести бюджеты, аналитику и категории из `app.js` в отдельные модули.
4. После проверки удалить резервные `phase*.js/css`.
5. Удалить старые Next.js / Prisma / Docker-файлы, которые не участвуют в текущей GitHub Pages версии.
