import { test, expect } from '@playwright/test';

test.describe('E2E-INTG: 集成管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="integrations"]');
    await expect(page.locator('#page-integrations.active')).toBeVisible();
  });

  test('E2E-INTG-01: 集成列表渲染', async ({ page }) => {
    const cards = page.locator('#page-integrations .card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(5); // GitHub, 飞书, Notion, Telegram, 微信, + 添加集成
  });

  test('E2E-INTG-02: 已连接状态显示', async ({ page }) => {
    const connected = page.locator('#page-integrations .badge-green');
    const count = await connected.count();
    expect(count).toBeGreaterThanOrEqual(3); // GitHub, 飞书, Notion
  });

  test('E2E-INTG-03: 未配置状态显示', async ({ page }) => {
    const notConfigured = page.locator('#page-integrations .badge-gray');
    const count = await notConfigured.count();
    expect(count).toBeGreaterThanOrEqual(2); // Telegram, 微信
  });

  test('E2E-INTG-04: 添加集成按钮存在', async ({ page }) => {
    // 最后一个卡片应该是"添加集成"
    const cards = page.locator('#page-integrations .card');
    const lastCard = cards.last();
    await expect(lastCard).toBeVisible();
    const text = await lastCard.textContent();
    expect(text).toContain('添加');
  });
});
