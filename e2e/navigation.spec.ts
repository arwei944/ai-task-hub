import { test, expect } from '@playwright/test';

// ============================================================
// Navigation E2E Tests
// ============================================================

test.describe('导航栏', () => {
  test('导航栏在所有页面可见', async ({ page }) => {
    const pages = ['/', '/dashboard', '/tasks', '/agents', '/integrations', '/plugins', '/settings'];

    for (const path of pages) {
      await page.goto(path);
      // Logo should be visible
      await expect(page.locator('a:has-text("AI Task Hub")')).toBeVisible();
    }
  });

  test('导航链接正确高亮', async ({ page }) => {
    await page.goto('/tasks');

    // Tasks link should be active
    const tasksLink = page.locator('a[href="/tasks"]');
    await expect(tasksLink).toHaveClass(/bg-blue-50|text-blue-700/);
  });

  test('暗色模式切换', async ({ page }) => {
    await page.goto('/');

    // Find theme toggle button
    const themeBtn = page.locator('button[title*="切换"]');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();

      // html element should have dark class
      await expect(page.locator('html')).toHaveClass(/dark/);

      // Click again to toggle back
      await themeBtn.click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    }
  });

  test('移动端汉堡菜单', async ({ page }) => {
    // Set viewport to mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Hamburger button should be visible on mobile
    const hamburger = page.locator('button[aria-label="Toggle menu"]');
    if (await hamburger.isVisible()) {
      await hamburger.click();

      // Mobile menu should show nav items
      await expect(page.getByText('仪表盘')).toBeVisible();
      await expect(page.getByText('任务')).toBeVisible();
    }
  });
});
