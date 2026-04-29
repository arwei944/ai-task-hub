import type { StepHandler, StepHandlerDeps, SOLOSubAgentType } from '../types';
export class AIAnalyzeStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}
  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    if (!this.deps.soloBridge) throw new Error('SOLO Bridge is required for ai-analyze step');
    const mode = String(config.mode ?? 'analyze');
    const input = config.input ?? context;
    const prompt = String(config.prompt ?? `Analyze the following data and provide a structured result:\n${JSON.stringify(input, null, 2)}`);
    const subAgentMap: Record<string, SOLOSubAgentType> = { extract: 'explore', decompose: 'plan', 'infer-status': 'explore', analyze: 'explore' };
    const result = await this.deps.soloBridge.call({ prompt, stepId: String(context._stepId ?? ''), executionId: String(context._executionId ?? ''), stepName: String(context._stepName ?? 'ai-analyze'), subAgentType: subAgentMap[mode] ?? 'explore', sessionId: context._soloSessionId as string | undefined, context, timeoutMs: Number(config.timeoutMs) || undefined });
    if (!result.success) throw new Error(`SOLO analysis failed: ${result.error}`);
    return { lastAiResult: result.data, _soloSessionId: result.sessionId };
  }
}