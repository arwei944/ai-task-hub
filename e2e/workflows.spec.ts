import { test, expect } from '@playwright/test';

test.describe('E2E-WF: 工作流测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.click('.nav-item[data-page="workflows"]');
    await expect(page.locator('#page-workflows.active')).toBeVisible();
  });

  test('E2E-WF-01: 工作流列表渲染', async ({ page }) => {
    // 页面应包含工作流卡片
    const workflowCards = page.locator('#page-workflows .card');
    const count = await workflowCards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('E2E-WF-02: 工作流步骤渲染', async ({ page }) => {
    const steps = page.locator('.workflow-step');
    const count = await steps.count();
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-WF-03: 步骤有名称和详情', async ({ page }) => {
    const firstStep = page.locator('.workflow-step').first();
    await expect(firstStep.locator('.step-name')).toBeVisible();
    await expect(firstStep.locator('.step-detail')).toBeVisible();
  });

  test('E2E-WF-04: 运行中步骤有脉冲动画', async ({ page }) => {
    const runningStep = page.locator('.step-indicator.running');
    const count = await runningStep.count();
    expect(count).toBeGreaterThan(0);

    // 验证动画
    const animation = await runningStep.first().evaluate(el => getComputedStyle(el).animationName);
    expect(animation).toBeTruthy();
  });

  test('E2E-WF-05: 已完成步骤显示勾号', async ({ page }) => {
    const doneSteps = page.locator('.step-indicator.done');
    const count = await doneSteps.count();
    expect(count).toBeGreaterThan(0);

    const text = await doneSteps.first().textContent();
    expect(text).toContain('✓');
  });

  test('E2E-WF-06: 错误步骤显示感叹号', async ({ page }) => {
    const errorSteps = page.locator('.step-indicator.error');
    const count = await errorSteps.count();
    expect(count).toBeGreaterThan(0);

    const text = await errorSteps.first().textContent();
    expect(text).toContain('!');
  });
});
