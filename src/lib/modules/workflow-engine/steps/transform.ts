import type { StepHandler, StepResult } from '../types';

/** Transform 步骤支持的操作类型 */
type TransformOperation = 'map' | 'filter' | 'reduce' | 'pick' | 'omit' | 'merge' | 'template';

/** Transform 步骤配置 */
interface TransformConfig {
  operation?: TransformOperation;
  source?: unknown;
  fields?: Record<string, string>;
  field?: string;
  value?: unknown;
  pickFields?: string[];
  omitFields?: string[];
  mergeSource?: unknown;
  mergeWith?: unknown;
  template?: string;
  /** reduce 操作的初始值 */
  initialValue?: unknown;
  /** reduce 操作的目标字段 */
  reduceField?: string;
  /** reduce 操作: 'sum' | 'count' | 'join' */
  reduceOp?: string;
  /** reduce join 的分隔符 */
  separator?: string;
}

/**
 * 数据转换步骤
 * 提供简单的基于规则的数据转换操作，不使用 eval()
 */
export class TransformStep implements StepHandler {
  async execute(config: Record<string, unknown>, context: Record<string, unknown>): Promise<StepResult> {
    const {
      operation,
      source,
    } = config as TransformConfig;

    if (!operation) {
      throw new Error('transform step requires "operation" in config');
    }

    // 获取源数据：优先使用 config.source，其次从 context 获取
    const data = source !== undefined ? source : context;

    switch (operation) {
      case 'map':
        return this.mapOperation(config as TransformConfig, data, context);
      case 'filter':
        return this.filterOperation(config as TransformConfig, data, context);
      case 'reduce':
        return this.reduceOperation(config as TransformConfig, data, context);
      case 'pick':
        return this.pickOperation(config as TransformConfig, data, context);
      case 'omit':
        return this.omitOperation(config as TransformConfig, data, context);
      case 'merge':
        return this.mergeOperation(config as TransformConfig, data, context);
      case 'template':
        return this.templateOperation(config as TransformConfig, context);
      default:
        throw new Error(`Unknown transform operation: ${operation}. Supported: map, filter, reduce, pick, omit, merge, template`);
    }
  }

  /**
   * map 操作：对数组中的每个对象进行字段映射
   * fields: { "newField": "oldField" } - 将 oldField 的值映射到 newField
   */
  private mapOperation(config: TransformConfig, data: unknown, context: Record<string, unknown>): StepResult {
    if (!Array.isArray(data)) {
      throw new Error('map operation requires source to be an array');
    }

    const fields = config.fields ?? {};
    const result = data.map(item => {
      if (typeof item !== 'object' || item === null) return item;

      const mapped: Record<string, unknown> = {};
      for (const [newKey, oldKey] of Object.entries(fields)) {
        const resolvedOldKey = this.resolveTemplate(String(oldKey), context);
        mapped[newKey] = (item as Record<string, unknown>)[resolvedOldKey];
      }
      return mapped;
    });

    return { result };
  }

  /**
   * filter 操作：按字段值过滤数组
   * field: 要过滤的字段名
   * value: 期望的值
   */
  private filterOperation(config: TransformConfig, data: unknown, context: Record<string, unknown>): StepResult {
    if (!Array.isArray(data)) {
      throw new Error('filter operation requires source to be an array');
    }

    const field = config.field;
    if (!field) {
      throw new Error('filter operation requires "field" in config');
    }

    const filterValue = config.value;

    const result = data.filter(item => {
      if (typeof item !== 'object' || item === null) return false;
      return (item as Record<string, unknown>)[field] === filterValue;
    });

    return { result };
  }

  /**
   * reduce 操作：对数组进行聚合
   * reduceOp: 'sum' | 'count' | 'join'
   * reduceField: 要聚合的字段名
   * initialValue: 初始值（仅用于 sum）
   * separator: join 的分隔符（默认 ','）
   */
  private reduceOperation(config: TransformConfig, data: unknown, context: Record<string, unknown>): StepResult {
    if (!Array.isArray(data)) {
      throw new Error('reduce operation requires source to be an array');
    }

    const reduceOp = config.reduceOp ?? 'count';
    const reduceField = config.reduceField;

    switch (reduceOp) {
      case 'sum': {
        if (!reduceField) {
          throw new Error('reduce "sum" operation requires "reduceField" in config');
        }
        const sum = data.reduce((acc, item) => {
          if (typeof item === 'object' && item !== null) {
            const val = (item as Record<string, unknown>)[reduceField];
            return acc + (typeof val === 'number' ? val : 0);
          }
          return acc;
        }, (config.initialValue as number) ?? 0);
        return { result: sum };
      }
      case 'count': {
        return { result: data.length };
      }
      case 'join': {
        const separator = config.separator ?? ',';
        const joined = data
          .map(item => {
            if (typeof item === 'object' && item !== null && reduceField) {
              return String((item as Record<string, unknown>)[reduceField] ?? '');
            }
            return String(item ?? '');
          })
          .join(separator);
        return { result: joined };
      }
      default:
        throw new Error(`Unknown reduce operation: ${reduceOp}. Supported: sum, count, join`);
    }
  }

  /**
   * pick 操作：从对象中选取指定字段
   * pickFields: 要保留的字段名数组
   */
  private pickOperation(config: TransformConfig, data: unknown, _context: Record<string, unknown>): StepResult {
    if (typeof data !== 'object' || data === null) {
      throw new Error('pick operation requires source to be an object');
    }

    const pickFields = config.pickFields ?? [];
    if (pickFields.length === 0) {
      throw new Error('pick operation requires "pickFields" in config');
    }

    const result: Record<string, unknown> = {};
    const source = data as Record<string, unknown>;
    for (const field of pickFields) {
      if (field in source) {
        result[field] = source[field];
      }
    }

    return { result };
  }

  /**
   * omit 操作：从对象中移除指定字段
   * omitFields: 要移除的字段名数组
   */
  private omitOperation(config: TransformConfig, data: unknown, _context: Record<string, unknown>): StepResult {
    if (typeof data !== 'object' || data === null) {
      throw new Error('omit operation requires source to be an object');
    }

    const omitFields = config.omitFields ?? [];
    if (omitFields.length === 0) {
      throw new Error('omit operation requires "omitFields" in config');
    }

    const result: Record<string, unknown> = {};
    const source = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(source)) {
      if (!omitFields.includes(key)) {
        result[key] = value;
      }
    }

    return { result };
  }

  /**
   * merge 操作：合并两个数据源
   * mergeSource: 要合并的第二个数据源（如果未指定，从 context 获取）
   * mergeWith: 要合并的第二个数据源（config 中的直接值）
   */
  private mergeOperation(config: TransformConfig, data: unknown, context: Record<string, unknown>): StepResult {
    const secondSource = config.mergeWith ?? config.mergeSource ?? {};

    if (typeof data !== 'object' || data === null || typeof secondSource !== 'object' || secondSource === null) {
      throw new Error('merge operation requires both source and merge target to be objects');
    }

    const result = {
      ...(data as Record<string, unknown>),
      ...(secondSource as Record<string, unknown>),
    };

    return { result };
  }

  /**
   * template 操作：简单的字符串模板替换
   * template: 包含 {{variable}} 占位符的模板字符串
   */
  private templateOperation(config: TransformConfig, context: Record<string, unknown>): StepResult {
    const template = config.template;
    if (!template) {
      throw new Error('template operation requires "template" in config');
    }

    const result = this.resolveTemplate(String(template), context);

    return { result };
  }

  /**
   * 解析模板变量 {{varName}} 或 {{varName.nested}}
   */
  private resolveTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const parts = path.split('.');
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return '';
        }
      }
      return value !== undefined ? String(value) : '';
    });
  }
}
