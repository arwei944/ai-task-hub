import { test, expect } from '@playwright/test';

test.describe('E2E-OBS: 可观测性测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="observability"]');
    await expect(page.locator('#page-observability.active')).toBeVisible();
  });

  test('E2E-OBS-01: 统计概览渲染', async ({ page }) => {
    const statCards = page.locator('#page-observability .stat-card');
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // 验证统计卡片有数值
    for (let i = 0; i < Math.min(count, 3); i++) {
      await expect(statCards.nth(i).locator('.stat-value')).toBeVisible();
    }
  });

  test('E2E-OBS-02: 执行记录表渲染', async ({ page }) => {
    const rows = page.locator('#page-observability .table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('E2E-OBS-03: 执行记录有状态徽章', async ({ page }) => {
    const badges = page.locator('#page-observability .table .badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-OBS-04: 统计卡片显示关键指标', async ({ page }) => {
    const statValues = page.locator('#page-observability .stat-value');
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // 验证数值不是空的
    for (let i = 0; i < count; i++) {
      const text = await statValues.nth(i).textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});
