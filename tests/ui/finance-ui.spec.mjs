import {test,expect} from '@playwright/test';

test('клик по дате меняет историю, а Сегодня возвращает текущий день',async({page})=>{
  await page.goto('/tests/ui/date-ribbon-harness.html');
  const days=page.locator('.pirate-day');
  await expect(days).toHaveCount(17);
  const initial=await page.evaluate(()=>state.overviewDateKey);
  await days.nth(7).click();
  await expect(page.locator('#overviewHistoryList')).not.toHaveAttribute('data-date',initial);
  const changed=await page.locator('#overviewHistoryList').getAttribute('data-date');
  expect(changed).toBeTruthy();
  await page.locator('.pirate-today').click();
  await expect(page.locator('#overviewHistoryList')).toHaveAttribute('data-date',initial);
});

test('перевод создаётся как нейтральная операция между двумя супругами',async({page})=>{
  await page.goto('/tests/ui/transfer-harness.html');
  await page.locator('#openTransfer').click();
  await expect(page.locator('#transferForm')).toBeVisible();
  await page.locator('#transferFrom').selectOption('p1');
  await page.locator('#transferTo').selectOption('p2');
  await page.locator('#transferAmount').fill('12500');
  await page.locator('#transferDescription').fill('Тест перевода');
  await page.locator('#saveTransfer').click();
  await expect(page.locator('#transferForm')).toHaveCount(0);
  const result=await page.evaluate(()=>({call:window.__lastTransfer,row:window.__savedRow}));
  expect(result.call.name).toBe('create_family_transfer');
  expect(result.call.args.p_from_person_id).toBe('p1');
  expect(result.call.args.p_to_person_id).toBe('p2');
  expect(result.call.args.p_amount).toBe(12500);
  expect(result.row.type).toBe('transfer');
  expect(result.row.category_id).toBeNull();
});

test('нажатие Обзор всегда возвращает страницу наверх',async({page})=>{
  await page.goto('/tests/ui/nav-harness.html');
  await page.evaluate(()=>window.scrollTo(0,1200));
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(500);
  await page.locator('[data-view="overview"]').click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
});
