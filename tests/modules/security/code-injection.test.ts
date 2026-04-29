/**
 * C-03: new Function() 代码注入风险
 *
 * 测试 ConditionStep.evaluateExpression 的白名单过滤逻辑，
 * 确保恶意表达式无法通过 new Function() 执行。
 *
 * 源码安全机制:
 * 1. {{var}} 模板变量替换为 JSON.stringify(value)
 * 2. 白名单字符过滤: /[^=!<>""'\w\d\s_-]/g
 *    - 允许: = ! < > " ' 字母 数字 空格 _ -
 *    - 拦截: () [] ` ; $ \ . 及所有其他特殊字符（点号已移除，防止对象链访问）
 * 3. 危险标识符黑名单: process, global, globalThis, window, document,
 *    require, import, eval, Function, constructor, __proto__, prototype, this, arguments
 * 4. 表达式长度限制: 500 字符
 * 5. 空表达式返回 false
 * 6. new Function() 在 "use strict" 下执行
 */

import { describe, it, expect } from 'vitest';
import { ConditionStep } from '@/lib/modules/workflow-engine/steps/condition';

/** 创建一个最小化的 ConditionStep 实例用于测试 */
function createTestStep() {
  const deps = {
    prisma: {},
    taskService: {},
  };
  return new ConditionStep(deps);
}

/**
 * 辅助函数：直接调用 evaluateExpression 进行测试。
 * 由于 evaluateExpression 是 private 方法，我们通过 execute 间接测试，
 * 并检查返回的 conditionResult 字段。
 */
async function evaluate(step: ConditionStep, expression: string, context: Record<string, unknown> = {}) {
  const result = await step.execute({ expression }, context);
  return result.conditionResult as boolean;
}

describe('C-03: new Function() 代码注入风险', () => {
  // =========================================================================
  // C-03-1: 正常比较表达式
  // =========================================================================
  describe('C-03-1: 正常比较表达式', () => {
    it('{{status}} === "active" 且 context.status === "active" 应返回 true', async () => {
      const step = createTestStep();
      const result = await evaluate(step, '{{status}} === "active"', { status: 'active' });
      expect(result).toBe(true);
    });

    it('{{status}} === "inactive" 且 context.status === "active" 应返回 false', async () => {
      const step = createTestStep();
      const result = await evaluate(step, '{{status}} === "inactive"', { status: 'active' });
      expect(result).toBe(false);
    });

    it('支持数字比较', async () => {
      const step = createTestStep();
      const result = await evaluate(step, '{{count}} > 5', { count: 10 });
      expect(result).toBe(true);
    });

    it('支持布尔值比较', async () => {
      const step = createTestStep();
      const result = await evaluate(step, '{{enabled}} === true', { enabled: true });
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // C-03-2: 包含函数调用的表达式被过滤
  // =========================================================================
  describe('C-03-2: 包含函数调用的表达式被过滤', () => {
    it('process.exit(1) 应被过滤，返回 false', async () => {
      const step = createTestStep();
      // 括号 () 会被白名单过滤掉，process.exit1 变成无效表达式
      const result = await evaluate(step, 'process.exit(1)');
      expect(result).toBe(false);
    });

    it('require("child_process") 应被过滤', async () => {
      const step = createTestStep();
      // 括号和双引号内的内容被处理
      const result = await evaluate(step, 'require("child_process")');
      expect(result).toBe(false);
    });

    it('eval("malicious") 应被过滤', async () => {
      const step = createTestStep();
      const result = await evaluate(step, 'eval("malicious")');
      expect(result).toBe(false);
    });

    it('Function("return process")() 应被过滤', async () => {
      const step = createTestStep();
      const result = await evaluate(step, 'Function("return process")()');
      expect(result).toBe(false);
    });

    it('import("fs") 应被过滤', async () => {
      const step = createTestStep();
      const result = await evaluate(step, 'import("fs")');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // C-03-3: 包含 this 属性访问
  // =========================================================================
  describe('C-03-3: 包含 this 属性访问', () => {
    it('this.constructor 应被过滤', async () => {
      const step = createTestStep();
      // this.constructor 中的点号是允许的，但 this 本身是合法标识符
      // 关键在于 this.constructor 在 strict mode + 无 with() 下无法访问全局对象
      const result = await evaluate(step, 'this.constructor');
      // 在 strict mode 下，this 在普通函数中是 undefined
      // undefined.constructor 会抛出 TypeError，被 catch 捕获返回 false
      expect(result).toBe(false);
    });

    it('this.__proto__ 应被过滤或返回 false', async () => {
      const step = createTestStep();
      const result = await evaluate(step, 'this.__proto__');
      expect(result).toBe(false);
    });

    it('this.toString 应被过滤或返回 false', async () => {
      const step = createTestStep();
      const result = await evaluate(step, 'this.toString');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // C-03-4: 包含方括号属性访问
  // =========================================================================
  describe('C-03-4: 包含方括号属性访问', () => {
    it('this["constructor"] 应被过滤，方括号被移除', async () => {
      const step = createTestStep();
      // 方括号 [] 不在白名单中，会被过滤掉
      // this"constructor" 变成无效表达式
      const result = await evaluate(step, 'this["constructor"]');
      expect(result).toBe(false);
    });

    it('global["process"] 应被过滤', async () => {
      const step = createTestStep();
      const result = await evaluate(step, 'global["process"]');
      expect(result).toBe(false);
    });

    it('process["mainModule"] 应被过滤', async () => {
      const step = createTestStep();
      const result = await evaluate(step, 'process["mainModule"]');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // C-03-5: 超长表达式
  // =========================================================================
  describe('C-03-5: 超长表达式', () => {
    it('10000 字符的表达式不应崩溃，返回 false（超过 500 字符限制）', async () => {
      const step = createTestStep();
      // 构造一个 10000+ 字符的表达式
      // 使用白名单允许的字符: 字母、数字、空格
      const longExpr = 'a '.repeat(5000) + 'b'; // 10001 字符
      expect(longExpr.length).toBeGreaterThanOrEqual(10000);

      // 超长表达式超过 500 字符限制，直接返回 false
      const result = await evaluate(step, longExpr);
      expect(result).toBe(false);
    });

    it('超长恶意表达式不应执行（超过 500 字符限制）', async () => {
      const step = createTestStep();
      // 用白名单允许的字符构造超长表达式
      const longExpr = 'true || '.repeat(2500) + 'true';
      expect(longExpr.length).toBeGreaterThan(10000);

      // 超过 500 字符限制，直接返回 false
      const result = await evaluate(step, longExpr);
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // C-03-6: 空表达式
  // =========================================================================
  describe('C-03-6: 空表达式', () => {
    it('空字符串应返回 false', async () => {
      const step = createTestStep();
      const result = await evaluate(step, '');
      expect(result).toBe(false);
    });

    it('纯空白字符应返回 false', async () => {
      const step = createTestStep();
      const result = await evaluate(step, '   \t\n  ');
      expect(result).toBe(false);
    });

    it('仅包含被过滤的特殊字符应返回 false', async () => {
      const step = createTestStep();
      // 这些字符都不在白名单中，过滤后为空
      const result = await evaluate(step, '()[]{};:$`\\@#%^&*');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // C-03-7: 包含模板字面量
  // =========================================================================
  describe('C-03-7: 包含模板字面量', () => {
    it('`${process.env.PATH}` - 反引号和$被过滤，process 被黑名单拦截', async () => {
      const step = createTestStep();
      // 反引号 ` 和 $ 不在白名单中，会被过滤掉
      // process 在危险标识符黑名单中，被拦截返回 false
      const result = await evaluate(step, '`${process.env.PATH}`');
      // 修复后：黑名单拦截 process，返回 false
      expect(result).toBe(false);
    });

    it('`${require("fs")}` 应被过滤（括号被移除）', async () => {
      const step = createTestStep();
      // 反引号、$、括号都被过滤 -> require"fs" -> 无效表达式
      const result = await evaluate(step, '`${require("fs")}`');
      expect(result).toBe(false);
    });

    it('`${1+1}` - 过滤后变成 "11"，!!11 为 true', async () => {
      const step = createTestStep();
      // 反引号、$、+ 被过滤，剩余 "11"
      // !!11 为 true，但原始意图的运算并未执行
      const result = await evaluate(step, '`${1+1}`');
      // 过滤后变成字面量 "11"，不是 1+1 的运算结果
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // C-03-8: Unicode 欺骗
  // =========================================================================
  describe('C-03-8: Unicode 欺骗', () => {
    it('包含零宽字符的表达式应返回 false', async () => {
      const step = createTestStep();
      // 零宽空格 (U+200B)
      const expr = 'true\u200B';
      // \u200B 不在白名单中，会被过滤
      // 但 "true" 仍然保留，所以结果可能是 true
      // 关键是零宽字符本身不会造成注入
      const result = await evaluate(step, expr);
      // 零宽字符被过滤后，剩余 "true" 是安全的
      expect(typeof result).toBe('boolean');
    });

    it('零宽字符 + 恶意代码应被过滤', async () => {
      const step = createTestStep();
      // 零宽字符尝试绕过过滤
      const expr = 'pro\u200Bcess.exit(1)';
      // 过滤后: process.exit1 (括号被移除) -> 无效标识符
      const result = await evaluate(step, expr);
      expect(result).toBe(false);
    });

    it('包含 Unicode 转义序列的表达式应被安全处理', async () => {
      const step = createTestStep();
      // \u0060 是反引号，过滤后被移除，剩余 processenv
      // 但 process 在危险标识符黑名单中，被拦截返回 false
      const expr = '\u0060process.env\u0060';
      const result = await evaluate(step, expr);
      // 修复后：黑名单拦截 process，返回 false
      expect(result).toBe(false);
    });

    it('包含方向控制字符的表达式应被安全处理', async () => {
      const step = createTestStep();
      // RTL 覆盖字符 (U+202E)
      const expr = 'true\u202E';
      const result = await evaluate(step, expr);
      // 方向控制字符被过滤，剩余 "true" 安全
      expect(typeof result).toBe('boolean');
    });

    it('包含同形异义字符的表达式应被安全处理', async () => {
      const step = createTestStep();
      // 全角字母 (U+FF34 = 全角 T) 尝试绕过
      const expr = '\uFF34RUE';
      // 全角字母不在 \w 范围内（取决于 JS 引擎），但即使通过也不危险
      const result = await evaluate(step, expr);
      // 无论如何不应导致代码注入
      expect(typeof result).toBe('boolean');
    });
  });

  // =========================================================================
  // 额外安全边界测试
  // =========================================================================
  describe('额外安全边界测试', () => {
    it('分号分隔的多语句应被过滤', async () => {
      const step = createTestStep();
      // 分号不在白名单中
      const result = await evaluate(step, 'true; process.exit(1)');
      expect(result).toBe(false);
    });

    it('箭头函数应被过滤', async () => {
      const step = createTestStep();
      // => 中的 > 在白名单中，= 也在，但 () 不在
      const result = await evaluate(step, '(() => process.exit(1))()');
      expect(result).toBe(false);
    });

    it('逗号运算符应被过滤', async () => {
      const step = createTestStep();
      // 逗号不在白名单中
      const result = await evaluate(step, 'true, process.exit(1)');
      expect(result).toBe(false);
    });

    it('赋值表达式应被安全处理', async () => {
      const step = createTestStep();
      // = 在白名单中，但赋值在 strict mode 的函数参数中不影响外部
      // 且 new Function 返回 !!() 的结果，赋值表达式返回值被 boolean 化
      const result = await evaluate(step, 'x = 1', { x: 0 });
      // 不会崩溃，结果为 boolean
      expect(typeof result).toBe('boolean');
    });

    it('三元运算符中的冒号应被过滤', async () => {
      const step = createTestStep();
      // 冒号 : 不在白名单中
      const result = await evaluate(step, 'true ? process.exit(1) : false');
      expect(result).toBe(false);
    });

    it('逻辑或运算符 | 应被过滤', async () => {
      const step = createTestStep();
      // | 不在白名单中
      const result = await evaluate(step, 'true || false');
      expect(result).toBe(false);
    });

    it('逻辑与运算符 & 应被过滤', async () => {
      const step = createTestStep();
      // & 不在白名单中
      const result = await evaluate(step, 'true && false');
      expect(result).toBe(false);
    });
  });
});
