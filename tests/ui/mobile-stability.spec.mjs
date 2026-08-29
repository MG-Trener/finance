import {test,expect} from '@playwright/test';

test('мобильная форма создаёт расход с выбранной категорией',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/transaction-form-harness.html');
  await page.locator('#amount').fill('3050');
  await page.locator('.save-operation').click();
  const saved=await page.evaluate(()=>window.__lastSave);
  expect(saved.payload.type).toBe('expense');
  expect(saved.payload.amount).toBe(3050);
  expect(saved.payload.category_id).toBe('ce1');
  expect(saved.payload.person_id).toBe('p1');
});

test('переключение на доход обновляет категории и сохраняет доход',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/transaction-form-harness.html');
  await page.locator('[data-type="income"]').click();
  await expect(page.locator('#categoryId')).toHaveValue('ci1');
  await expect(page.locator('#subcategoryId')).toHaveValue('si1');
  await page.locator('#amount').fill('250000');
  await page.locator('.save-operation').click();
  const saved=await page.evaluate(()=>window.__lastSave);
  expect(saved.payload.type).toBe('income');
  expect(saved.payload.category_id).toBe('ci1');
});

test('смена супруга обновляет скрытого участника формы',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/transaction-form-harness.html');
  await page.locator('[data-person="p2"]').click();
  await expect(page.locator('#personId')).toHaveValue('p2');
  await expect(page.locator('[data-person="p2"]')).toHaveClass(/active/);
});

test('редактирование операции открывается сверху и получает отдельный класс',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/transaction-form-harness.html');
  await page.locator('#openEdit').click();
  await expect(page.locator('#modal')).toHaveClass(/modal-layout-top/);
  await expect(page.locator('.transaction-edit-modal')).toBeVisible();
  const box=await page.locator('.transaction-edit-modal').boundingBox();
  expect(box).toBeTruthy();
  expect(box.y).toBeLessThanOrEqual(24);
  expect(box.y+box.height).toBeLessThanOrEqual(844);
});

test('в редактировании нет Недавних, заголовок компактный и окно прокручивается',async({page})=>{
  await page.setViewportSize({width:390,height:640});
  await page.goto('/tests/ui/transaction-form-harness.html');
  await expect(page.locator('.entry-card .quick-pairs')).toBeVisible();
  await page.locator('#openEdit').click();
  await expect(page.locator('.transaction-edit-modal .quick-pairs')).toHaveCount(0);
  const metrics=await page.locator('.transaction-edit-modal').evaluate(modal=>{
    const heading=modal.querySelector('.modal-head h2');
    const style=getComputedStyle(modal);
    const headingStyle=getComputedStyle(heading);
    modal.scrollTop=modal.scrollHeight;
    return {clientHeight:modal.clientHeight,scrollHeight:modal.scrollHeight,scrollTop:modal.scrollTop,overflowY:style.overflowY,headingSize:parseFloat(headingStyle.fontSize)};
  });
  expect(metrics.headingSize).toBeLessThanOrEqual(26);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(['auto','scroll']).toContain(metrics.overflowY);
  expect(metrics.scrollTop).toBeGreaterThan(0);
});

test('кнопка редактирования идёт после даты и не sticky, а главная кнопка остаётся sticky',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/transaction-form-harness.html');
  const primaryPosition=await page.locator('.entry-card .save-row').evaluate(el=>getComputedStyle(el).position);
  expect(primaryPosition).toBe('sticky');
  await page.locator('#openEdit').click();
  const result=await page.locator('.transaction-edit-modal').evaluate(modal=>{
    const time=modal.querySelector('.time-details'),save=modal.querySelector('.save-row');
    return {savePosition:getComputedStyle(save).position,timeBefore:Boolean(time.compareDocumentPosition(save)&Node.DOCUMENT_POSITION_FOLLOWING)};
  });
  expect(result.savePosition).toBe('static');
  expect(result.timeBefore).toBeTruthy();
});

test('нижняя навигация читаема и помещается на основных ширинах Android',async({page})=>{
  await page.goto('/tests/ui/mobile-layout-harness.html');
  for(const width of [360,390,412,480]){
    await page.setViewportSize({width,height:900});
    const metrics=await page.locator('.side-nav').evaluate(nav=>({scrollWidth:nav.scrollWidth,clientWidth:nav.clientWidth,font:parseFloat(getComputedStyle(nav.querySelector('.nav-label')).fontSize),count:nav.querySelectorAll('.nav-item').length}));
    expect(metrics.count).toBe(6);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth+2);
    expect(metrics.font).toBeGreaterThanOrEqual(9);
  }
});

test('последняя операция компактна, а SVG корзины ровно центрирован',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/mobile-layout-harness.html');
  const buttons=page.locator('.overview-last .tx-actions .btn');
  const edit=await buttons.nth(0).boundingBox(),remove=await buttons.nth(1).boundingBox();
  expect(edit).toBeTruthy();expect(remove).toBeTruthy();
  expect(remove.width).toBeLessThanOrEqual(50);
  expect(edit.width).toBeGreaterThan(remove.width*2);
  const icon=buttons.nth(1).locator('svg');
  await expect(icon).toHaveCount(1);
  const alignment=await buttons.nth(1).evaluate(el=>{
    const svg=el.querySelector('svg'),buttonRect=el.getBoundingClientRect(),iconRect=svg.getBoundingClientRect();
    return {pseudo:getComputedStyle(el,'::before').display,dx:Math.abs((buttonRect.left+buttonRect.width/2)-(iconRect.left+iconRect.width/2)),dy:Math.abs((buttonRect.top+buttonRect.height/2)-(iconRect.top+iconRect.height/2)),iconWidth:iconRect.width,iconHeight:iconRect.height};
  });
  expect(alignment.pseudo).toBe('none');
  expect(alignment.dx).toBeLessThanOrEqual(1);
  expect(alignment.dy).toBeLessThanOrEqual(1);
  expect(alignment.iconWidth).toBeGreaterThanOrEqual(19);
  expect(alignment.iconHeight).toBeGreaterThanOrEqual(19);
});

test('быстрое исправление суммы открывается как центрированная доступная модалка',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/mobile-layout-harness.html');
  await page.locator('#openQuick').click();
  await expect(page.locator('#modal')).toHaveClass(/modal-layout-center/);
  await expect(page.locator('.quick-amount-modal')).toHaveAttribute('role','dialog');
  await expect(page.locator('.quick-amount-modal')).toHaveAttribute('aria-modal','true');
  const box=await page.locator('.quick-amount-modal').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y+box.height).toBeLessThanOrEqual(844);
});

test('обычная мобильная модалка остаётся нижним sheet и не наследует режим редактирования',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/ui/mobile-layout-harness.html');
  await page.locator('#openGeneric').click();
  await expect(page.locator('#modal')).toHaveClass(/modal-layout-sheet/);
  await expect(page.locator('#modal')).not.toHaveClass(/modal-layout-top/);
  const box=await page.locator('#modal>.modal').boundingBox();
  expect(box.y+box.height).toBeGreaterThanOrEqual(820);
});

test('подписи полей в мобильных формах не становятся микроскопическими',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.goto('/tests/ui/mobile-layout-harness.html');
  const size=await page.locator('.entry-card .field label').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(11);
});
