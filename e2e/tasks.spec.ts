import { test, expect } from '@playwright/test';

test.describe('E2E-TASK: 任务管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="tasks"]');
    await expect(page.locator('#page-tasks.active')).toBeVisible();
  });

  test('E2E-TASK-01: 看板视图渲染 - 4 列', async ({ page }) => {
    const cols = page.locator('.kanban-col');
    await expect(cols).toHaveCount(4);
  });

  test('E2E-TASK-02: 看板列标题正确', async ({ page }) => {
    await expect(page.locator('.kanban-col-title', { hasText: '待办' })).toBeVisible();
    await expect(page.locator('.kanban-col-title', { hasText: '进行中' })).toBeVisible();
    await expect(page.locator('.kanban-col-title', { hasText: '审核中' })).toBeVisible();
    await expect(page.locator('.kanban-col-title', { hasText: '已完成' })).toBeVisible();
  });

  test('E2E-TASK-03: 看板卡片渲染', async ({ page }) => {
    const cards = page.locator('.kanban-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-TASK-04: 任务卡片有标题', async ({ page }) => {
    const firstCard = page.locator('.kanban-card').first();
    await expect(firstCard.locator('.kanban-card-title')).toBeVisible();
    const title = await firstCard.locator('.kanban-card-title').textContent();
    expect(title?.length).toBeGreaterThan(0);
  });

  test('E2E-TASK-05: 任务卡片有标签', async ({ page }) => {
    const tags = page.locator('.kanban-tag');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-TASK-06: 任务卡片有优先级徽章', async ({ page }) => {
    const badges = page.locator('.kanban-card .badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-TASK-07: 看板列计数显示', async ({ page }) => {
    const counts = page.locator('.kanban-col-count');
    await expect(counts).toHaveCount(4);

    // 验证计数是数字
    for (let i = 0; i < 4; i++) {
      const text = await counts.nth(i).textContent();
      expect(parseInt(text || '0')).toBeGreaterThanOrEqual(0);
    }
  });

  test('E2E-TASK-08: 新建任务按钮存在', async ({ page }) => {
    const btn = page.locator('#page-tasks .btn-primary');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('新建任务');
  });

  test('E2E-TASK-09: 筛选按钮存在', async ({ page }) => {
    // 筛选按钮的 class 是 .btn，不是 .btn-ghost
    const filterBtn = page.locator('#page-tasks .btn').filter({ hasText: '筛选' });
    await expect(filterBtn).toBeVisible();
  });

  test('E2E-TASK-10: 任务卡片包含 Critical 标签', async ({ page }) => {
    const criticalTag = page.locator('.kanban-tag', { hasText: 'Critical' });
    const count = await criticalTag.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-TASK-11: 已完成列有卡片', async ({ page }) => {
    const doneCol = page.locator('.kanban-col').filter({ hasText: '已完成' });
    const cards = doneCol.locator('.kanban-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-TASK-12: 看板布局为网格', async ({ page }) => {
    const kanban = page.locator('.kanban');
    await expect(kanban).toBeVisible();
    const display = await kanban.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('grid');
  });
});
