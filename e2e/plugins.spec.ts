import { test, expect } from '@playwright/test';

// ============================================================
// Plugins E2E Tests
// ============================================================

test.describe('插件管理页面', () => {
  test('插件页面正确渲染', async ({ page }) => {
    await page.goto('/plugins');

    await expect(page.getByRole('heading', { name: '插件管理' })).toBeVisible();
    await expect(page.getByText('管理和扩展系统功能')).toBeVisible();
  });

  test('安装插件按钮可见', async ({ page }) => {
    await page.goto('/plugins');

    await expect(page.getByRole('button', { name: '+ 安装插件' })).toBeVisible();
  });

  test('点击安装显示表单', async ({ page }) => {
    await page.goto('/plugins');

    await page.getByRole('button', { name: '+ 安装插件' }).click();

    // Install form should appear
    await expect(page.getByRole('heading', { name: '安装新插件' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g., hello-world')).toBeVisible();
    await expect(page.getByPlaceholder('e.g., Hello World')).toBeVisible();
  });

  test('安装表单可以取消', async ({ page }) => {
    await page.goto('/plugins');

    await page.getByRole('button', { name: '+ 安装插件' }).click();
    await expect(page.getByRole('heading', { name: '安装新插件' })).toBeVisible();

    await page.getByRole('button', { name: '取消' }).click();

    // Form should be hidden
    await expect(page.getByRole('heading', { name: '安装新插件' })).not.toBeVisible();
  });

  test('空状态显示提示', async ({ page }) => {
    await page.goto('/plugins');

    // Should show empty state
    await expect(page.getByText('暂无插件')).toBeVisible();
    await expect(page.getByText('点击上方"安装插件"按钮来添加新插件')).toBeVisible();
  });
});
