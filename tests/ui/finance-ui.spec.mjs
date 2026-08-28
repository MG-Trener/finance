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

test('перевод меняет супругов реверсом, остаётся в модалке и показывает успех',async({page})=>{
  await page.setViewportSize({width:390,height:760});
  await page.goto('/tests/ui/transfer-harness.html');
  await page.locator('.amount-transfer-row').scrollIntoViewIfNeeded();

  const amountBox=await page.locator('.amount-field').boundingBox();
  const transferBox=await page.locator('#openTransfer').boundingBox();
  expect(amountBox).toBeTruthy();expect(transferBox).toBeTruthy();
  expect(amountBox.x).toBeLessThan(transferBox.x);
  expect(amountBox.width).toBeGreaterThan(transferBox.width*1.35);

  const scrollBefore=await page.evaluate(()=>window.scrollY);
  await page.locator('#openTransfer').click();
  await expect(page.locator('#transferForm')).toBeVisible();
  await expect(page.locator('#modal')).toHaveClass(/modal-layout-center/);
  const modalBox=await page.locator('.transfer-modal').boundingBox();
  expect(modalBox).toBeTruthy();
  expect(modalBox.y).toBeGreaterThanOrEqual(0);
  expect(modalBox.y+modalBox.height).toBeLessThanOrEqual(760);
  const scrollAfter=await page.evaluate(()=>window.scrollY);
  expect(Math.abs(scrollAfter-scrollBefore)).toBeLessThanOrEqual(2);

  await expect(page.locator('#transferFrom')).toHaveValue('Михаил');
  await expect(page.locator('#transferTo')).toHaveValue('Огонек');
  await page.locator('#reverseTransfer').click();
  await expect(page.locator('#transferFrom')).toHaveValue('Огонек');
  await expect(page.locator('#transferTo')).toHaveValue('Михаил');

  await page.locator('#transferAmount').fill('12500');
  await page.locator('#transferDescription').fill('Тест перевода');
  await page.locator('#saveTransfer').click();
  await expect(page.locator('#transferForm')).toBeVisible();
  await expect(page.locator('#transferNotice')).toContainText('Перевод успешно выполнен');
  const result=await page.evaluate(()=>({call:window.__lastTransfer,row:window.__savedRow}));
  expect(result.call.name).toBe('create_family_transfer');
  expect(result.call.args.p_from_person_id).toBe('p2');
  expect(result.call.args.p_to_person_id).toBe('p1');
  expect(result.call.args.p_amount).toBe(12500);
  expect(result.row.type).toBe('transfer');
  expect(result.row.category_id).toBeNull();
});

test('новый перевод создаётся офлайн и попадает в локальную очередь',async({page})=>{
  await page.setViewportSize({width:390,height:760});
  await page.goto('/tests/ui/transfer-harness.html');
  await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));
  await page.locator('#openTransfer').click();
  await page.locator('#transferAmount').fill('7000');
  await page.locator('#saveTransfer').click();
  await expect(page.locator('#transferNotice')).toContainText('сохранён офлайн');
  const result=await page.evaluate(()=>({row:window.__savedRow,pending:window.FinanceTransferOffline.pendingCount}));
  expect(result.row.id).toMatch(/^offline:transfer:/);
  expect(result.row.transfer_to_person_id).toBe('p2');
  expect(result.row._offline).toBeTruthy();
  expect(result.pending).toBe(1);
});

test('нажатие Обзор всегда возвращает страницу наверх',async({page})=>{
  await page.goto('/tests/ui/nav-harness.html');
  await page.evaluate(()=>window.scrollTo(0,1200));
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(500);
  await page.locator('[data-view="overview"]').click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
});
