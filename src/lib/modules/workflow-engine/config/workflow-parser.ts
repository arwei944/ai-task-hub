import type {
  CreateWorkflowDTO, WorkflowStep, TriggerType, StepType,
  FeedbackMode, SOLOCallMode, SOLOSubAgentType, RetryPolicy, WorkflowSOLOConfig,
} from '../types';

const VALID_STEP_TYPES: StepType[] = [
  'create-task', 'update-status', 'ai-analyze', 'send-notification', 'wait',
  'parallel-group', 'condition', 'foreach', 'invoke-agent', 'http-request', 'transform', 'approval',
];

const VALID_TRIGGER_TYPES: TriggerType[] = ['manual', 'webhook', 'schedule', 'event', 'github-issue', 'approval'];
const VALID_FEEDBACK_MODES: FeedbackMode[] = ['auto', 'notify', 'block', 'smart'];
const VALID_SOLO_CALL_MODES: SOLOCallMode[] = ['mcp', 'rest', 'pull'];
const VALID_SOLO_SUB_AGENTS: SOLOSubAgentType[] = ['explore', 'plan', 'general_purpose'];

export class WorkflowParser {
  parse(markdown: string): CreateWorkflowDTO {
    const normalized = markdown.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const dto: CreateWorkflowDTO = { name: '', steps: [] };

    this.parseTitleAndDescription(lines, dto);
    const sections = this.findSections(lines);

    if (sections.has('trigger')) this.parseTrigger(lines, sections.get('trigger')!, dto);
    if (sections.has('variables')) this.parseVariables(lines, sections.get('variables')!, dto);
    if (sections.has('steps')) this.parseSteps(lines, sections.get('steps')!, dto);
    if (sections.has('retry policy')) this.parseRetryPolicy(lines, sections.get('retry policy')!, dto);
    if (sections.has('concurrency')) this.parseConcurrency(lines, sections.get('concurrency')!, dto);
    if (sections.has('timeout')) this.parseTimeout(lines, sections.get('timeout')!, dto);
    if (sections.has('solo config')) this.parseSOLOConfig(lines, sections.get('solo config')!, dto);

    return dto;
  }

  private parseTitleAndDescription(lines: string[], dto: CreateWorkflowDTO): void {
    let titleFound = false;
    const descriptionLines: string[] = [];
    for (const line of lines) {
      if (!titleFound) {
        const titleMatch = line.match(/^#\s+(.+)$/);
        if (titleMatch) { dto.name = titleMatch[1].trim(); titleFound = true; continue; }
      } else {
        if (line.match(/^##\s+/)) break;
        const trimmed = line.trim();
        if (trimmed) descriptionLines.push(trimmed);
      }
    }
    if (descriptionLines.length > 0) dto.description = descriptionLines.join('\n');
  }

  private findSections(lines: string[]): Map<string, { start: number; end: number }> {
    const sections = new Map<string, { start: number; end: number }>();
    const sectionRegex = /^##\s+(.+)$/;
    let currentSection: { name: string; start: number } | null = null;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(sectionRegex);
      if (match) {
        if (currentSection) sections.set(currentSection.name.toLowerCase(), { start: currentSection.start, end: i });
        currentSection = { name: match[1].trim(), start: i + 1 };
      }
    }
    if (currentSection) sections.set(currentSection.name.toLowerCase(), { start: currentSection.start, end: lines.length });
    return sections;
  }

  private parseTrigger(lines: string[], range: { start: number; end: number }, dto: CreateWorkflowDTO): void {
    const content = this.extractContent(lines, range);
    const typeMatch = content.match(/type:\s*(.+)/);
    const configMatch = content.match(/config:\s*(.+)/);
    if (typeMatch) {
      const triggerType = typeMatch[1].trim().toLowerCase();
      if (VALID_TRIGGER_TYPES.includes(triggerType as TriggerType)) dto.trigger = triggerType as TriggerType;
    }
    if (configMatch) dto.triggerConfig = configMatch[1].trim();
  }

  private parseVariables(lines: string[], range: { start: number; end: number }, dto: CreateWorkflowDTO): void {
    const variables: Record<string, unknown> = {};
    for (let i = range.start; i < range.end; i++) {
      const line = lines[i].trim();
      const match = line.match(/^-\s+(\w+):\s*(\w+)(?:\s*=\s*(.+))?$/);
      if (match) {
        const varName = match[1]; const varType = match[2].toLowerCase(); const defaultVal = match[3]?.trim();
        if (defaultVal !== undefined) { variables[varName] = this.parseDefaultValue(defaultVal, varType); }
        else {
          switch (varType) {
            case 'string': variables[varName] = ''; break;
            case 'number': case 'integer': variables[varName] = 0; break;
            case 'boolean': variables[varName] = false; break;
            case 'array': variables[varName] = []; break;
            case 'object': variables[varName] = {}; break;
            default: variables[varName] = null;
          }
        }
      }
    }
    if (Object.keys(variables).length > 0) dto.variables = variables;
  }

  private parseDefaultValue(value: string, type: string): unknown {
    try {
      switch (type) {
        case 'number': case 'integer': return Number(value);
        case 'boolean': return value.toLowerCase() === 'true';
        case 'array': case 'object': return JSON.parse(value);
        default: return value;
      }
    } catch { return value; }
  }

  private parseSteps(lines: string[], range: { start: number; end: number }, dto: CreateWorkflowDTO): void {
    const steps: WorkflowStep[] = [];
    let currentStep: Partial<WorkflowStep> | null = null;
    let currentConfigLines: string[] = [];
    let currentSoloLines: string[] = [];
    let inConfig = false;
    let inSolo = false;
    let stepIndex = 0;

    for (let i = range.start; i < range.end; i++) {
      const line = lines[i];
      const stepMatch = line.match(/^###\s+(?:(\d+)\.\s*)?(.+)$/);
      if (stepMatch) {
        if (currentStep) { this.finalizeStep(currentStep, currentConfigLines, currentSoloLines, steps, stepIndex); stepIndex++; }
        currentStep = { name: stepMatch[2].trim(), config: {} };
        currentConfigLines = []; currentSoloLines = []; inConfig = false; inSolo = false;
        continue;
      }
      if (!currentStep) continue;
      const trimmed = line.trimEnd();
      const indent = line.length - line.trimStart().length;
      if (indent === 0 && trimmed === '') {
        if (inConfig && currentConfigLines.length > 0) {
          const nextNonEmpty = this.findNextNonEmpty(lines, i + 1, range.end);
          if (nextNonEmpty === null || lines[nextNonEmpty].length - lines[nextNonEmpty].trimStart().length === 0) inConfig = false;
        }
        if (inSolo && currentSoloLines.length > 0) {
          const nextNonEmpty = this.findNextNonEmpty(lines, i + 1, range.end);
          if (nextNonEmpty === null || lines[nextNonEmpty].length - lines[nextNonEmpty].trimStart().length === 0) inSolo = false;
        }
        continue;
      }
      if (indent === 0) { inConfig = false; inSolo = false; }
      if (indent === 0) {
        const propMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
        if (propMatch) {
          const key = propMatch[1]; const value = propMatch[2].trim();
          switch (key) {
            case 'type': currentStep.type = value as StepType; break;
            case 'feedback': if (VALID_FEEDBACK_MODES.includes(value as FeedbackMode)) currentStep.feedbackMode = value as FeedbackMode; break;
            case 'config':
              if (value) { try { currentStep.config = JSON.parse(value); } catch { currentStep.config = { value }; } } else { inConfig = true; }
              break;
            case 'solo':
              if (value) { try { this.applySoloConfig(currentStep, JSON.parse(value)); } catch { /* ignore */ } } else { inSolo = true; }
              break;
            case 'ontimeout': case 'onerror': currentStep.onError = value as 'continue' | 'fail'; break;
            case 'timeout': currentStep.timeoutMs = parseInt(value, 10) || undefined; break;
          }
        }
      } else if (inConfig) { currentConfigLines.push(trimmed); }
      else if (inSolo) { currentSoloLines.push(trimmed); }
      else {
        const propMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
        if (propMatch) {
          const key = propMatch[1]; const value = propMatch[2].trim();
          if (key === 'config') { if (value) { try { currentStep.config = JSON.parse(value); } catch { currentStep.config = { value }; } } else { inConfig = true; currentConfigLines = []; } }
          else if (key === 'solo') { if (value) { try { this.applySoloConfig(currentStep, JSON.parse(value)); } catch { /* ignore */ } } else { inSolo = true; currentSoloLines = []; } }
          else if (key === 'type') currentStep.type = value as StepType;
          else if (key === 'feedback') { if (VALID_FEEDBACK_MODES.includes(value as FeedbackMode)) currentStep.feedbackMode = value as FeedbackMode; }
        }
      }
    }
    if (currentStep) this.finalizeStep(currentStep, currentConfigLines, currentSoloLines, steps, stepIndex);
    dto.steps = steps;
  }

  private findNextNonEmpty(lines: string[], start: number, end: number): number | null {
    for (let i = start; i < end; i++) { if (lines[i].trim() !== '') return i; }
    return null;
  }

  private finalizeStep(step: Partial<WorkflowStep>, configLines: string[], soloLines: string[], steps: WorkflowStep[], index: number): void {
    if (configLines.length > 0) step.config = this.parseYamlLikeBlock(configLines);
    if (soloLines.length > 0) { const soloObj = this.parseYamlLikeBlock(soloLines); this.applySoloConfig(step, soloObj); }
    steps.push({
      id: `step-${index + 1}`, name: step.name || `Step ${index + 1}`, type: step.type || 'create-task',
      config: step.config || {}, feedbackMode: step.feedbackMode, onError: step.onError,
      timeoutMs: step.timeoutMs, soloSubAgent: step.soloSubAgent, soloCallMode: step.soloCallMode,
    });
  }

  private parseYamlLikeBlock(lines: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const match = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (match) {
        const key = match[1]; let value: unknown = match[2].trim();
        if (value === '') {
          const subLines: string[] = []; i++;
          while (i < lines.length && (lines[i].startsWith('  ') || lines[i].startsWith('\t') || lines[i].trim() === '')) {
            if (lines[i].trim() !== '') subLines.push(lines[i].trim()); i++;
          }
          if (subLines.length > 0) {
            const allKv = subLines.every(l => /^\w[\w-]*:/.test(l));
            if (allKv) value = this.parseYamlLikeBlock(subLines); else value = subLines.join('\n');
          } else { value = null; }
          result[key] = value; continue;
        } else {
          if (typeof value === 'string') { try { value = JSON.parse(value as string); } catch { /* keep as string */ } }
          result[key] = value;
        }
      }
      i++;
    }
    return result;
  }

  private applySoloConfig(step: Partial<WorkflowStep>, soloObj: Record<string, unknown>): void {
    if (soloObj.subAgent && VALID_SOLO_SUB_AGENTS.includes(soloObj.subAgent as SOLOSubAgentType)) step.soloSubAgent = soloObj.subAgent as SOLOSubAgentType;
    if (soloObj.callMode && VALID_SOLO_CALL_MODES.includes(soloObj.callMode as SOLOCallMode)) step.soloCallMode = soloObj.callMode as SOLOCallMode;
    if (soloObj.timeout && typeof soloObj.timeout === 'number') step.timeoutMs = soloObj.timeout;
  }

  private parseRetryPolicy(lines: string[], range: { start: number; end: number }, dto: CreateWorkflowDTO): void {
    const content = this.extractContent(lines, range);
    const policy: Partial<RetryPolicy> = {};
    const maxMatch = content.match(/max:\s*(\d+)/);
    const backoffMatch = content.match(/backoff:\s*(\w+)/);
    const delayMatch = content.match(/delay:\s*(\d+)/);
    if (maxMatch) policy.max = parseInt(maxMatch[1], 10);
    if (backoffMatch) { const backoff = backoffMatch[1].toLowerCase(); if (backoff === 'fixed' || backoff === 'exponential' || backoff === 'linear') policy.backoff = backoff; }
    if (delayMatch) policy.delayMs = parseInt(delayMatch[1], 10);
    if (policy.max !== undefined || policy.backoff || policy.delayMs !== undefined) {
      dto.retryPolicy = { max: policy.max ?? 3, backoff: policy.backoff ?? 'exponential', delayMs: policy.delayMs ?? 1000 };
    }
  }

  private parseConcurrency(lines: string[], range: { start: number; end: number }, dto: CreateWorkflowDTO): void {
    const content = this.extractContent(lines, range);
    const limitMatch = content.match(/limit:\s*(\d+)/);
    if (limitMatch) dto.concurrencyLimit = parseInt(limitMatch[1], 10);
  }

  private parseTimeout(lines: string[], range: { start: number; end: number }, dto: CreateWorkflowDTO): void {
    const content = this.extractContent(lines, range);
    const msMatch = content.match(/ms:\s*(\d+)/);
    if (msMatch) dto.timeoutMs = parseInt(msMatch[1], 10);
  }

  private parseSOLOConfig(lines: string[], range: { start: number; end: number }, dto: CreateWorkflowDTO): void {
    const content = this.extractContent(lines, range);
    const soloConfig: WorkflowSOLOConfig = {};
    const modeMatch = content.match(/defaultMode:\s*(\w+)/);
    const agentMatch = content.match(/defaultSubAgent:\s*(\w+)/);
    const timeoutMatch = content.match(/defaultTimeout:\s*(\d+)/);
    if (modeMatch && VALID_SOLO_CALL_MODES.includes(modeMatch[1] as SOLOCallMode)) soloConfig.defaultMode = modeMatch[1] as SOLOCallMode;
    if (agentMatch && VALID_SOLO_SUB_AGENTS.includes(agentMatch[1] as SOLOSubAgentType)) soloConfig.defaultSubAgent = agentMatch[1] as SOLOSubAgentType;
    if (timeoutMatch) soloConfig.defaultTimeoutMs = parseInt(timeoutMatch[1], 10);
    if (Object.keys(soloConfig).length > 0) dto.soloConfig = soloConfig;
  }

  private extractContent(lines: string[], range: { start: number; end: number }): string {
    return lines.slice(range.start, range.end).join('\n');
  }
}

export function parseWorkflowMarkdown(markdown: string): CreateWorkflowDTO {
  return new WorkflowParser().parse(markdown);
}
