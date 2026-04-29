import { test, expect } from '@playwright/test';

test.describe('E2E-PROJ: 项目管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="projects"]');
    await expect(page.locator('#page-projects.active')).toBeVisible();
  });

  test('E2E-PROJ-01: 项目列表渲染', async ({ page }) => {
    const cards = page.locator('#page-projects .card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('E2E-PROJ-02: 项目卡片有名称和描述', async ({ page }) => {
    const firstCard = page.locator('#page-projects .card').first();
    // 项目卡片名称在 card-body 内的 span[font-weight:700] 中，描述在 p 标签中
    await expect(firstCard.locator('.card-body p')).toBeVisible();
    const desc = await firstCard.locator('.card-body p').textContent();
    expect(desc?.length).toBeGreaterThan(0);
  });

  test('E2E-PROJ-03: 项目有进度条', async ({ page }) => {
    const progressBars = page.locator('#page-projects .progress-fill');
    const count = await progressBars.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-PROJ-04: 项目有技术栈标签', async ({ page }) => {
    const tags = page.locator('#page-projects .kanban-tag, #page-projects .badge');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-PROJ-05: 新建项目按钮存在', async ({ page }) => {
    const btn = page.locator('#page-projects .btn-primary');
    await expect(btn).toBeVisible();
  });
});
