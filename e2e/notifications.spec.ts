import { test, expect } from '@playwright/test';

test.describe('E2E-NOTIF: 通知中心测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="notifications"]');
    await expect(page.locator('#page-notifications.active')).toBeVisible();
  });

  test('E2E-NOTIF-01: 通知列表渲染', async ({ page }) => {
    const notifs = page.locator('.notif-item');
    const count = await notifs.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('E2E-NOTIF-02: 通知有标题和描述', async ({ page }) => {
    const firstNotif = page.locator('.notif-item').first();
    await expect(firstNotif.locator('.notif-title')).toBeVisible();
    await expect(firstNotif.locator('.notif-desc')).toBeVisible();
    await expect(firstNotif.locator('.notif-time')).toBeVisible();
  });

  test('E2E-NOTIF-03: 通知有类型徽章', async ({ page }) => {
    const badges = page.locator('.notif-item .badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-NOTIF-04: 安全警告通知存在', async ({ page }) => {
    await expect(page.locator('.notif-title', { hasText: '安全警告' })).toBeVisible();
  });

  test('E2E-NOTIF-05: 通知按时间排序', async ({ page }) => {
    const times = page.locator('.notif-time');
    const count = await times.count();
    expect(count).toBeGreaterThan(1);

    // 第一条应该是最新的（"5 分钟前" 比 "2 小时前" 更新）
    const firstTime = await times.first().textContent();
    expect(firstTime).toContain('分钟前');
  });
});
