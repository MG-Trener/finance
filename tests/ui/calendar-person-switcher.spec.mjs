import {test,expect} from '@playwright/test';

test('переключатель календаря меняет выбранного супруга и остаётся читаемым на мобильном',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.goto('/tests/ui/calendar-person-switcher-harness.html');
  const switcher=page.locator('.calendar-person-switcher');
  const buttons=switcher.locator('[data-calendar-person]');
  await expect(buttons).toHaveCount(2);
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed','true');
  await buttons.nth(1).click();
  await expect(page.locator('#selected')).toHaveText('wife');
  await expect(buttons.nth(1)).toHaveClass(/is-active/);
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed','true');
  const metrics=await switcher.evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth+1);
});
