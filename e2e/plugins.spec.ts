import { test, expect } from '@playwright/test';

test.describe('E2E-PLUG: 插件管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="plugins"]');
    await expect(page.locator('#page-plugins.active')).toBeVisible();
  });

  test('E2E-PLUG-01: 插件表格渲染', async ({ page }) => {
    const rows = page.locator('#page-plugins .table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('E2E-PLUG-02: 插件有版本号', async ({ page }) => {
    const rows = page.locator('#page-plugins .table tbody tr');
    const firstRow = rows.first();
    const text = await firstRow.textContent();
    expect(text).toMatch(/v\d+\.\d+\.\d+/);
  });

  test('E2E-PLUG-03: 插件有状态徽章', async ({ page }) => {
    const badges = page.locator('#page-plugins .table .badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-PLUG-04: 插件有操作按钮', async ({ page }) => {
    const buttons = page.locator('#page-plugins .btn-sm');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});
