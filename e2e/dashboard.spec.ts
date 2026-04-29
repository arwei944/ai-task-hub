import { test, expect } from '@playwright/test';

test.describe('E2E-DASH: 仪表盘测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await expect(page.locator('#page-dashboard.active')).toBeVisible();
  });

  test('E2E-DASH-01: 统计卡片渲染', async ({ page }) => {
    const statCards = page.locator('#page-dashboard .stat-card');
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // 验证每个统计卡片有数值
    for (let i = 0; i < count; i++) {
      await expect(statCards.nth(i).locator('.stat-value')).toBeVisible();
    }
  });

  test('E2E-DASH-02: 趋势图渲染', async ({ page }) => {
    const chartBars = page.locator('#page-dashboard .chart-bar');
    const count = await chartBars.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-DASH-03: 活动时间线', async ({ page }) => {
    const timeline = page.locator('#page-dashboard .timeline-item');
    const count = await timeline.count();
    expect(count).toBeGreaterThan(0);

    // 验证时间线条目有内容
    const firstItem = timeline.first();
    await expect(firstItem).toBeVisible();
  });

  test('E2E-DASH-04: 模块覆盖率进度条', async ({ page }) => {
    const progressBars = page.locator('#page-dashboard .progress-fill');
    const count = await progressBars.count();
    expect(count).toBeGreaterThan(0);

    // 验证进度条宽度为 100%（getComputedStyle 返回计算后的像素值，需检查 style 属性）
    const firstWidth = await progressBars.first().getAttribute('style');
    expect(firstWidth).toContain('width:100%');
  });

  test('E2E-DASH-05: 系统状态显示', async ({ page }) => {
    // 验证有"运行中"状态标签
    const greenBadges = page.locator('#page-dashboard .badge-green');
    const count = await greenBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-DASH-06: 页面标题和面包屑', async ({ page }) => {
    await expect(page.locator('#page-title')).toHaveText('仪表盘');
    await expect(page.locator('#page-breadcrumb')).toBeVisible();
  });
});
