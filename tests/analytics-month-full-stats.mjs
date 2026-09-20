import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const appCss=fs.readFileSync('src/css/app.css','utf8');
const feature=fs.readFileSync('src/js/features/analytics-month-full-stats.js','utf8');
const styles=fs.readFileSync('src/css/pages/analytics-month-full-stats.css','utf8');

assert.match(index,/analytics-month-full-stats\.js/,'month analytics extension must be loaded');
assert.match(appCss,/analytics-month-full-stats\.css/,'month analytics styles must be imported');
assert.doesNotMatch(feature,/analytics-month-full-stats/,'summary KPI block must not be rendered');
assert.match(feature,/Категории доходов/,'income category widget is required');
assert.match(feature,/Подкатегории доходов/,'income subcategory widget is required');
assert.match(feature,/Категории расходов/,'expense category widget is required');
assert.match(feature,/Подкатегории расходов/,'expense subcategory widget is required');
assert.match(feature,/analytics-detail-total/,'detail blocks must render control totals');
assert.match(feature,/analyticsCategoryList=function/,'doughnut detail list must be expanded');
assert.match(styles,/analytics-linear-grid/,'linear widget grid styles are required');
assert.match(styles,/\.analytics-linear-rows\{[^}]*max-height:none[^}]*overflow:visible/,'linear rows must not use nested scrolling');
assert.match(styles,/\.analytics-category-list-full\{[^}]*max-height:none[^}]*overflow:visible/,'category lists must not use nested scrolling');

console.log('analytics month detail: ok');
