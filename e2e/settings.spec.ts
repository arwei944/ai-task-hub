import { test, expect } from '@playwright/test';

test.describe('E2E-SET: 设置页面测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="settings"]');
    await expect(page.locator('#page-settings.active')).toBeVisible();
  });

  test('E2E-SET-01: 安全配置显示', async ({ page }) => {
    // 安全配置卡片应该有"需要关注"标签
    const alertBadge = page.locator('#page-settings .badge-red');
    const count = await alertBadge.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-SET-02: 安全警告显示', async ({ page }) => {
    const codeBlocks = page.locator('#page-settings code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThanOrEqual(3); // JWT, 密码, 备份 API

    // 验证包含安全相关警告
    const allText = await page.locator('#page-settings').textContent();
    expect(allText).toContain('JWT');
    expect(allText).toContain('admin');
  });

  test('E2E-SET-03: 系统信息显示', async ({ page }) => {
    const allText = await page.locator('#page-settings').textContent();
    // 版本号从 package.json 动态读取，匹配 semver 格式
    expect(allText).toMatch(/v\d+\.\d+\.\d+/);
    expect(allText).toContain('Next.js');
    expect(allText).toContain('SQLite');
  });

  test('E2E-SET-04: 系统信息包含测试和部署', async ({ page }) => {
    const allText = await page.locator('#page-settings').textContent();
    expect(allText).toContain('1,107'); // 测试用例数
    expect(allText).toContain('HF Spaces'); // 部署平台
  });
});
