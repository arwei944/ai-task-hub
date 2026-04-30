// ============================================================
// Transform Step Tests (Phase 6 - v2.0.0-beta.2)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransformStep } from '@/lib/modules/workflow-engine/steps/transform';

describe('TransformStep', () => {
  let step: TransformStep;

  beforeEach(() => {
    step = new TransformStep();
  });

  describe('map operation', () => {
    it('should map fields from array of objects', async () => {
      const data = [
        { name: 'Alice', age: 30, city: 'NYC' },
        { name: 'Bob', age: 25, city: 'LA' },
      ];

      const result = await step.execute(
        {
          operation: 'map',
          source: data,
          fields: { fullName: 'name', userAge: 'age' },
        },
        {},
      );

      expect(result.result).toEqual([
        { fullName: 'Alice', userAge: 30 },
        { fullName: 'Bob', userAge: 25 },
      ]);
    });

    it('should resolve template variables in field mappings', async () => {
      const data = [{ firstName: 'John', lastName: 'Doe' }];

      const result = await step.execute(
        {
          operation: 'map',
          source: data,
          fields: { full: '{{mappingField}}' },
        },
        { mappingField: 'firstName' },
      );

      expect(result.result).toEqual([{ full: 'John' }]);
    });

    it('should throw if source is not an array', async () => {
      await expect(
        step.execute({ operation: 'map', source: { name: 'test' }, fields: {} }, {}),
      ).rejects.toThrow('map operation requires source to be an array');
    });
  });

  describe('filter operation', () => {
    it('should filter array by field value', async () => {
      const data = [
        { name: 'Alice', role: 'admin' },
        { name: 'Bob', role: 'user' },
        { name: 'Charlie', role: 'admin' },
      ];

      const result = await step.execute(
        {
          operation: 'filter',
          source: data,
          field: 'role',
          value: 'admin',
        },
        {},
      );

      expect(result.result).toHaveLength(2);
      expect(result.result).toEqual([
        { name: 'Alice', role: 'admin' },
        { name: 'Charlie', role: 'admin' },
      ]);
    });

    it('should return empty array if no matches', async () => {
      const data = [{ name: 'Alice', role: 'admin' }];

      const result = await step.execute(
        {
          operation: 'filter',
          source: data,
          field: 'role',
          value: 'guest',
        },
        {},
      );

      expect(result.result).toEqual([]);
    });

    it('should throw if field is not specified', async () => {
      await expect(
        step.execute({ operation: 'filter', source: [] }, {}),
      ).rejects.toThrow('filter operation requires "field" in config');
    });

    it('should throw if source is not an array', async () => {
      await expect(
        step.execute({ operation: 'filter', source: 'not array', field: 'x', value: 'y' }, {}),
      ).rejects.toThrow('filter operation requires source to be an array');
    });
  });

  describe('pick operation', () => {
    it('should pick specified fields from object', async () => {
      const data = { name: 'Alice', age: 30, city: 'NYC', email: 'alice@test.com' };

      const result = await step.execute(
        {
          operation: 'pick',
          source: data,
          pickFields: ['name', 'email'],
        },
        {},
      );

      expect(result.result).toEqual({ name: 'Alice', email: 'alice@test.com' });
    });

    it('should ignore fields that do not exist in source', async () => {
      const data = { name: 'Alice' };

      const result = await step.execute(
        {
          operation: 'pick',
          source: data,
          pickFields: ['name', 'nonexistent'],
        },
        {},
      );

      expect(result.result).toEqual({ name: 'Alice' });
    });

    it('should throw if pickFields is empty', async () => {
      await expect(
        step.execute({ operation: 'pick', source: { a: 1 }, pickFields: [] }, {}),
      ).rejects.toThrow('pick operation requires "pickFields" in config');
    });

    it('should throw if source is not an object', async () => {
      await expect(
        step.execute({ operation: 'pick', source: 'string', pickFields: ['a'] }, {}),
      ).rejects.toThrow('pick operation requires source to be an object');
    });
  });

  describe('omit operation', () => {
    it('should omit specified fields from object', async () => {
      const data = { name: 'Alice', age: 30, city: 'NYC', email: 'alice@test.com' };

      const result = await step.execute(
        {
          operation: 'omit',
          source: data,
          omitFields: ['age', 'email'],
        },
        {},
      );

      expect(result.result).toEqual({ name: 'Alice', city: 'NYC' });
    });

    it('should return full object if omitFields has no matching fields', async () => {
      const data = { name: 'Alice', age: 30 };

      const result = await step.execute(
        {
          operation: 'omit',
          source: data,
          omitFields: ['nonexistent'],
        },
        {},
      );

      expect(result.result).toEqual({ name: 'Alice', age: 30 });
    });

    it('should throw if omitFields is empty', async () => {
      await expect(
        step.execute({ operation: 'omit', source: { a: 1 }, omitFields: [] }, {}),
      ).rejects.toThrow('omit operation requires "omitFields" in config');
    });

    it('should throw if source is not an object', async () => {
      await expect(
        step.execute({ operation: 'omit', source: null, omitFields: ['a'] }, {}),
      ).rejects.toThrow('omit operation requires source to be an object');
    });
  });

  describe('merge operation', () => {
    it('should merge two objects', async () => {
      const data = { name: 'Alice', age: 30 };

      const result = await step.execute(
        {
          operation: 'merge',
          source: data,
          mergeWith: { city: 'NYC', email: 'alice@test.com' },
        },
        {},
      );

      expect(result.result).toEqual({
        name: 'Alice',
        age: 30,
        city: 'NYC',
        email: 'alice@test.com',
      });
    });

    it('should let mergeWith override source fields', async () => {
      const data = { name: 'Alice', age: 30 };

      const result = await step.execute(
        {
          operation: 'merge',
          source: data,
          mergeWith: { age: 35 },
        },
        {},
      );

      expect(result.result).toEqual({ name: 'Alice', age: 35 });
    });

    it('should use mergeSource as fallback for mergeWith', async () => {
      const data = { name: 'Alice' };

      const result = await step.execute(
        {
          operation: 'merge',
          source: data,
          mergeSource: { city: 'NYC' },
        },
        {},
      );

      expect(result.result).toEqual({ name: 'Alice', city: 'NYC' });
    });

    it('should throw if source is not an object', async () => {
      await expect(
        step.execute({ operation: 'merge', source: 'string', mergeWith: {} }, {}),
      ).rejects.toThrow('merge operation requires both source and merge target to be objects');
    });
  });

  describe('template operation', () => {
    it('should replace template variables', async () => {
      const result = await step.execute(
        {
          operation: 'template',
          template: 'Hello, {{name}}! Your order #{{orderId}} is ready.',
        },
        { name: 'Alice', orderId: '12345' },
      );

      expect(result.result).toBe('Hello, Alice! Your order #12345 is ready.');
    });

    it('should replace missing variables with empty string', async () => {
      const result = await step.execute(
        {
          operation: 'template',
          template: 'Hello, {{name}}! Status: {{status}}',
        },
        { name: 'Bob' },
      );

      expect(result.result).toBe('Hello, Bob! Status: ');
    });

    it('should support nested variable paths', async () => {
      const result = await step.execute(
        {
          operation: 'template',
          template: 'User: {{user.name}}, Email: {{user.email}}',
        },
        { user: { name: 'Alice', email: 'alice@test.com' } },
      );

      expect(result.result).toBe('User: Alice, Email: alice@test.com');
    });

    it('should throw if template is not specified', async () => {
      await expect(
        step.execute({ operation: 'template' }, {}),
      ).rejects.toThrow('template operation requires "template" in config');
    });
  });

  describe('reduce operation', () => {
    it('should sum numeric field values', async () => {
      const data = [
        { name: 'Task A', hours: 5 },
        { name: 'Task B', hours: 3 },
        { name: 'Task C', hours: 7 },
      ];

      const result = await step.execute(
        {
          operation: 'reduce',
          source: data,
          reduceOp: 'sum',
          reduceField: 'hours',
        },
        {},
      );

      expect(result.result).toBe(15);
    });

    it('should count array elements', async () => {
      const data = [1, 2, 3, 4, 5];

      const result = await step.execute(
        {
          operation: 'reduce',
          source: data,
          reduceOp: 'count',
        },
        {},
      );

      expect(result.result).toBe(5);
    });

    it('should join array elements', async () => {
      const data = [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' },
      ];

      const result = await step.execute(
        {
          operation: 'reduce',
          source: data,
          reduceOp: 'join',
          reduceField: 'name',
          separator: '; ',
        },
        {},
      );

      expect(result.result).toBe('Alice; Bob; Charlie');
    });

    it('should use default separator for join', async () => {
      const data = [{ tag: 'a' }, { tag: 'b' }];

      const result = await step.execute(
        {
          operation: 'reduce',
          source: data,
          reduceOp: 'join',
          reduceField: 'tag',
        },
        {},
      );

      expect(result.result).toBe('a,b');
    });

    it('should throw for unknown reduce operation', async () => {
      await expect(
        step.execute({ operation: 'reduce', source: [], reduceOp: 'unknown' }, {}),
      ).rejects.toThrow('Unknown reduce operation: unknown');
    });

    it('should throw if source is not an array', async () => {
      await expect(
        step.execute({ operation: 'reduce', source: 'not array', reduceOp: 'count' }, {}),
      ).rejects.toThrow('reduce operation requires source to be an array');
    });
  });

  describe('error handling', () => {
    it('should throw when operation is missing', async () => {
      await expect(
        step.execute({}, {}),
      ).rejects.toThrow('transform step requires "operation" in config');
    });

    it('should throw for unknown operation', async () => {
      await expect(
        step.execute({ operation: 'explode' }, {}),
      ).rejects.toThrow('Unknown transform operation: explode');
    });
  });

  describe('context fallback', () => {
    it('should use context as source when config.source is not provided (pick operation)', async () => {
      const context = {
        name: 'Alice',
        age: 30,
        city: 'NYC',
      };

      const result = await step.execute(
        { operation: 'pick', pickFields: ['name', 'age'] },
        context,
      );

      expect(result.result).toEqual({ name: 'Alice', age: 30 });
    });

    it('should use context as source for template operation', async () => {
      const result = await step.execute(
        { operation: 'template', template: 'Hello, {{name}}!' },
        { name: 'Bob' },
      );

      expect(result.result).toBe('Hello, Bob!');
    });
  });
});
