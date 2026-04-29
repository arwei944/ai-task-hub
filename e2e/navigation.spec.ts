import { test, expect } from '@playwright/test';

test.describe('E2E-NAV: 全局导航测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
  });

  test('E2E-NAV-01: 侧边栏导航切换所有页面', async ({ page }) => {
    const navItems = page.locator('.nav-item[data-page]');
    const count = await navItems.count();
    expect(count).toBe(10); // 10 个导航项

    for (let i = 0; i < count; i++) {
      const pageName = await navItems.nth(i).getAttribute('data-page');
      await navItems.nth(i).click();
      await expect(page.locator(`#page-${pageName}.active`)).toBeVisible();
      // 验证只有一个页面是 active
      const activePages = await page.locator('.page.active').count();
      expect(activePages).toBe(1);
    }
  });

  test('E2E-NAV-02: 顶栏标题随导航更新', async ({ page }) => {
    await page.click('.nav-item[data-page="tasks"]');
    await expect(page.locator('#page-title')).toHaveText('任务管理');

    await page.click('.nav-item[data-page="workflows"]');
    await expect(page.locator('#page-title')).toHaveText('工作流引擎');

    await page.click('.nav-item[data-page="dashboard"]');
    await expect(page.locator('#page-title')).toHaveText('仪表盘');
  });

  test('E2E-NAV-03: 搜索框导航 - 多个关键词', async ({ page }) => {
    const searchTests = [
      { keyword: 'task', expectedPage: 'tasks' },
      { keyword: 'project', expectedPage: 'projects' },
      { keyword: 'workflow', expectedPage: 'workflows' },
      { keyword: 'agent', expectedPage: 'agents' },
      { keyword: 'setting', expectedPage: 'settings' },
    ];

    for (const { keyword, expectedPage } of searchTests) {
      await page.fill('.search-box input', '');
      await page.fill('.search-box input', keyword);
      await expect(page.locator(`#page-${expectedPage}.active`)).toBeVisible();
    }
  });

  test('E2E-NAV-04: 导航项激活状态', async ({ page }) => {
    // 初始状态：dashboard 激活
    await expect(page.locator('.nav-item[data-page="dashboard"].active')).toBeVisible();

    // 切换到 tasks
    await page.click('.nav-item[data-page="tasks"]');
    await expect(page.locator('.nav-item[data-page="tasks"].active')).toBeVisible();
    await expect(page.locator('.nav-item[data-page="dashboard"].active')).not.toBeVisible();

    // 切换回 dashboard
    await page.click('.nav-item[data-page="dashboard"]');
    await expect(page.locator('.nav-item[data-page="dashboard"].active')).toBeVisible();
  });

  test('E2E-NAV-05: 侧边栏徽章显示', async ({ page }) => {
    const badges = page.locator('.nav-badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    // 验证任务管理徽章显示 47
    const taskBadge = page.locator('.nav-item[data-page="tasks"] .nav-badge');
    await expect(taskBadge).toHaveText('47');
  });

  test('E2E-NAV-06: 用户信息卡片显示', async ({ page }) => {
    const userCard = page.locator('.user-card');
    await expect(userCard).toBeVisible();
    await expect(page.locator('.user-name')).toHaveText('Admin');
  });
});
