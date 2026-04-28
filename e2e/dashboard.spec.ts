import { test, expect } from '@playwright/test';

// ============================================================
// Dashboard E2E Tests
// ============================================================

test.describe('仪表盘页面', () => {
  test('仪表盘正确渲染', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
  });

  test('统计卡片显示', async ({ page }) => {
    await page.goto('/dashboard');

    // Should show 4 stat cards
    await expect(page.getByText('总任务数')).toBeVisible();
    await expect(page.getByText('完成率')).toBeVisible();
    await expect(page.getByText('进行中')).toBeVisible();
    await expect(page.getByText('超期任务')).toBeVisible();
  });

  test('趋势图区域可见', async ({ page }) => {
    await page.goto('/dashboard');

    // Should show trend chart section
    await expect(page.getByText('近 14 天趋势')).toBeVisible();
  });

  test('状态分布区域可见', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('状态分布')).toBeVisible();
  });

  test('风险预警区域可见', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('风险预警')).toBeVisible();
  });

  test('通知区域可见', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('通知')).toBeVisible();
  });
});
