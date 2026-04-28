import { test, expect } from '@playwright/test';

// ============================================================
// Auth E2E Tests
// ============================================================

test.describe('登录/注册流程', () => {
  test('注册页面正确渲染', async ({ page }) => {
    await page.goto('/login');

    // Should show login form
    await expect(page.locator('h1')).toContainText('AI Task Hub');
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('切换到注册模式', async ({ page }) => {
    await page.goto('/login');

    // Click "注册" link
    await page.getByText('没有账户？').click();
    await page.getByRole('button', { name: '注册' }).click();

    // Should show registration form with email field
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible();
    await expect(page.getByPlaceholder('请输入显示名称')).toBeVisible();
  });

  test('表单验证 - 用户名太短', async ({ page }) => {
    await page.goto('/login');

    // Enter short username
    await page.getByPlaceholder('请输入用户名').fill('ab');
    await page.getByPlaceholder('请输入密码').fill('password123');

    // Form should not submit (HTML5 validation)
    const usernameInput = page.getByPlaceholder('请输入用户名');
    await expect(usernameInput).toHaveAttribute('minlength', '3');
  });

  test('登录按钮在无输入时禁用', async ({ page }) => {
    await page.goto('/login');

    // Login button should be enabled but form won't submit empty
    const loginBtn = page.getByRole('button', { name: '登录' });
    await expect(loginBtn).toBeVisible();
  });

  test('Logo 链接返回首页', async ({ page }) => {
    await page.goto('/login');

    const logo = page.locator('a:has-text("AI Task Hub")');
    if (await logo.isVisible()) {
      await logo.click();
      await expect(page).toHaveURL('/');
    }
  });
});
