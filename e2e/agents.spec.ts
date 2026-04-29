import { test, expect } from '@playwright/test';

test.describe('E2E-AGENT: AI 智能体测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="agents"]');
    await expect(page.locator('#page-agents.active')).toBeVisible();
  });

  test('E2E-AGENT-01: 智能体列表渲染', async ({ page }) => {
    const agents = page.locator('.agent-card');
    await expect(agents).toHaveCount(3);
  });

  test('E2E-AGENT-02: 智能体有名称和类型', async ({ page }) => {
    await expect(page.locator('.agent-name', { hasText: 'SOLO AI' })).toBeVisible();
    await expect(page.locator('.agent-name', { hasText: 'GitHub Bot' })).toBeVisible();
    await expect(page.locator('.agent-name', { hasText: '飞书助手' })).toBeVisible();

    const firstType = page.locator('.agent-card').first().locator('.agent-type');
    await expect(firstType).toBeVisible();
  });

  test('E2E-AGENT-03: 智能体有统计数据', async ({ page }) => {
    const stats = page.locator('.agent-stat-value');
    const count = await stats.count();
    expect(count).toBeGreaterThanOrEqual(3); // 至少 3 个智能体各有多项统计
  });

  test('E2E-AGENT-04: 智能体卡片悬停效果', async ({ page }) => {
    const card = page.locator('.agent-card').first();
    const defaultShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
    await card.hover();
    const hoverShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
    // 悬停后阴影应该变化
    expect(hoverShadow).not.toBe(defaultShadow);
  });
});
