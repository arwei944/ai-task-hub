import type { StepHandler, StepHandlerDeps, SOLOSubAgentType } from '../types';

export class InvokeAgentStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}
  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    if (!this.deps.soloBridge) throw new Error('SOLO Bridge is required for invoke-agent step');
    const task = String(config.task ?? '');
    const agentType = (config.agentType as SOLOSubAgentType) ?? 'general_purpose';
    const callMode = (config.callMode as string) ?? undefined;
    const timeoutMs = Number(config.timeoutMs) || 120000;
    if (!task) throw new Error('invoke-agent requires a "task" parameter');
    const contextInfo = context.triggerPayload ? `\n\nContext from trigger: ${JSON.stringify(context.triggerPayload)}` : '';
    const prompt = `${task}${contextInfo}\n\nPlease execute this task and return a structured result.`;
    const result = await this.deps.soloBridge.call({
      prompt, stepId: String(context._stepId ?? ''), executionId: String(context._executionId ?? ''),
      stepName: String(context._stepName ?? 'invoke-agent'), subAgentType: agentType,
      callMode: callMode as any, sessionId: context._soloSessionId as string | undefined, context, timeoutMs,
    });
    if (!result.success) throw new Error(`Agent invocation failed: ${result.error}`);
    return { agentResult: result.data, _soloSessionId: result.sessionId, agentType, durationMs: result.durationMs, tokensUsed: result.tokensUsed };
  }
}