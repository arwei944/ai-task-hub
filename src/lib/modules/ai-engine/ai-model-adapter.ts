import type { ILogger } from '@/lib/core/types';
import { z } from 'zod';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface IAIModelAdapter {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  structured<T>(messages: ChatMessage[], schema: StructuredSchema<T>, options?: ChatOptions): Promise<T>;
  getModelName(): string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface StructuredSchema<T> {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  parse: (data: Record<string, unknown>) => T;
}

/**
 * OpenAI-compatible adapter using Vercel AI SDK.
 * Works with any OpenAI-compatible API (OpenAI, Ollama, etc.)
 */
export class OpenAICompatibleAdapter implements IAIModelAdapter {
  private modelName: string;
  private baseURL?: string;
  private apiKey?: string;
  private logger: ILogger;

  constructor(config: { model: string; baseURL?: string; apiKey?: string }, logger: ILogger) {
    this.modelName = config.model;
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.logger = logger;
  }

  getModelName(): string {
    return this.modelName;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    this.logger.debug(`AI chat request: ${messages.length} messages, model: ${this.modelName}`);
    const startTime = Date.now();

    try {
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const provider = createOpenAI({
        baseURL: this.baseURL,
        apiKey: this.apiKey,
      });

      const result = await generateText({
        model: provider(this.modelName),
        system: messages.find((m) => m.role === 'system')?.content,
        messages: messages.filter((m) => m.role !== 'system'),
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2000,
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`AI chat response: ${result.text.length} chars, ${duration}ms`);

      return result.text;
    } catch (error: any) {
      this.logger.error(`AI chat failed: ${error.message}`);
      throw new Error(`AI model call failed: ${error.message}`);
    }
  }

  async structured<T>(messages: ChatMessage[], schema: StructuredSchema<T>, options?: ChatOptions): Promise<T> {
    this.logger.debug(`AI structured request: ${schema.name}, model: ${this.modelName}`);
    const startTime = Date.now();

    try {
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');
      const { z } = await import('zod');

      const provider = createOpenAI({
        baseURL: this.baseURL,
        apiKey: this.apiKey,
      });

      // Build Zod schema from JSON schema
      const zodSchema = this.jsonSchemaToZod(schema.schema);

      const result = await generateText({
        model: provider(this.modelName),
        system: messages.find((m) => m.role === 'system')?.content,
        messages: messages.filter((m) => m.role !== 'system'),
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 4000,
      });

      // Parse the structured output from the response
      const jsonMatch = result.text.match(/```json\s*([\s\S]*?)```/) ||
        result.text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('AI response does not contain valid JSON');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const duration = Date.now() - startTime;
      this.logger.debug(`AI structured response: ${schema.name}, ${duration}ms`);

      return schema.parse(parsed);
    } catch (error: any) {
      this.logger.error(`AI structured call failed: ${error.message}`);
      throw new Error(`AI structured call failed: ${error.message}`);
    }
  }

  private jsonSchemaToZod(jsonSchema: Record<string, unknown>): any {
    // Simplified JSON Schema to Zod conversion
    const schema: Record<string, any> = {};

    for (const [key, value] of Object.entries(jsonSchema)) {
      if (typeof value === 'object' && value !== null) {
        const v = value as any;
        if (v.type === 'string') schema[key] = z.string();
        else if (v.type === 'number') schema[key] = z.number();
        else if (v.type === 'boolean') schema[key] = z.boolean();
        else if (v.type === 'array') schema[key] = z.array(z.any());
        else if (v.type === 'object') schema[key] = z.record(z.string(), z.any());
        else schema[key] = z.any();
      } else {
        schema[key] = z.any();
      }
    }
    return z.object(schema);
  }
}
