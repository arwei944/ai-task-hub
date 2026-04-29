import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImprovementLoop } from '@/lib/modules/workflow-engine/feedback/improvement-loop';
import type { ImprovementAnalysis, ImprovementRecommendation } from '@/lib/modules/workflow-engine/types';

function makeMockPrisma(checkpoints: any[] = [], stepFeedbacks: any[] = [], rules: any[] = []) {
  return {
    feedbackCheckpoint: {
      findMany: vi.fn().mockResolvedValue(checkpoints),
    },
    stepFeedback: {
      findMany: vi.fn().mockResolvedValue(stepFeedbacks),
    },
    feedbackRule: {
      create: vi.fn().mockResolvedValue({ id: 'rule-1' }),
    },
  };
}

function makeMockObservability(stepMetrics: any[] = []) {
  return {
    getStepMetrics: vi.fn().mockReturnValue(stepMetrics),
  };
}

function makeMockSoloBridge(response: any = null, error?: string) {
  return {
    call: vi.fn().mockResolvedValue({
      success: !error,
      data: response,
      error,
      sessionId: 'sess-1',
      durationMs: 100,
    }),
  };
}

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('ImprovementLoop', () => {
  let mockPrisma: any;
  let mockObservability: any;
  let mockSoloBridge: any;
  let mockLogger: any;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
    mockObservability = makeMockObservability();
    mockSoloBridge = makeMockSoloBridge();
    mockLogger = makeMockLogger();
  });

  describe('analyzeFeedbackPatterns', () => {
    it('should return analysis with zero values when no data', async () => {
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis = await loop.analyzeFeedbackPatterns({ days: 7 });

      expect(analysis.totalCheckpoints).toBe(0);
      expect(analysis.approvalRate).toBe(0);
      expect(analysis.rejectionRate).toBe(0);
      expect(analysis.timeoutRate).toBe(0);
      expect(analysis.avgRating).toBe(0);
      expect(analysis.stepTypeStats).toHaveLength(0);
      expect(analysis.topErrorPatterns).toHaveLength(0);
      expect(analysis.highRiskSteps).toHaveLength(0);
    });

    it('should calculate approval/rejection rates from checkpoints', async () => {
      const checkpoints = [
        { status: 'approved', stepType: 'create-task', stepName: 'A', stepId: 's1', rating: 4, createdAt: new Date() },
        { status: 'approved', stepType: 'create-task', stepName: 'B', stepId: 's2', rating: 5, createdAt: new Date() },
        { status: 'rejected', stepType: 'ai-analyze', stepName: 'C', stepId: 's3', rating: null, createdAt: new Date() },
        { status: 'timeout_expired', stepType: 'ai-analyze', stepName: 'D', stepId: 's4', rating: null, createdAt: new Date() },
      ];
      mockPrisma = makeMockPrisma(checkpoints);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis = await loop.analyzeFeedbackPatterns({ days: 7 });

      expect(analysis.totalCheckpoints).toBe(4);
      expect(analysis.approvalRate).toBeCloseTo(0.5);
      expect(analysis.rejectionRate).toBeCloseTo(0.25);
      expect(analysis.timeoutRate).toBeCloseTo(0.25);
      expect(analysis.avgRating).toBeCloseTo(4.5);
    });

    it('should identify high-risk steps from failure rates', async () => {
      // Provide checkpoints so that count > 0 for ai-analyze
      const checkpoints = [
        { status: 'approved', stepType: 'ai-analyze', stepName: 'A', stepId: 's1', rating: 4, createdAt: new Date() },
        { status: 'rejected', stepType: 'ai-analyze', stepName: 'B', stepId: 's2', rating: null, createdAt: new Date() },
        { status: 'rejected', stepType: 'ai-analyze', stepName: 'C', stepId: 's3', rating: null, createdAt: new Date() },
        { status: 'rejected', stepType: 'ai-analyze', stepName: 'D', stepId: 's4', rating: null, createdAt: new Date() },
      ];
      mockPrisma = makeMockPrisma(checkpoints);

      const metrics = [
        {
          stepType: 'ai-analyze',
          status: 'failed',
          durationMs: 5000,
          tokensUsed: 1000,
          error: 'Timeout error',
          timestamp: new Date(),
        },
        {
          stepType: 'ai-analyze',
          status: 'failed',
          durationMs: 3000,
          tokensUsed: 500,
          error: 'Timeout error',
          timestamp: new Date(),
        },
        {
          stepType: 'create-task',
          status: 'completed',
          durationMs: 100,
          timestamp: new Date(),
        },
      ];
      mockObservability = makeMockObservability(metrics);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis = await loop.analyzeFeedbackPatterns({ days: 7 });

      // ai-analyze: 2 failures out of 4 checkpoints = 50% failure rate > 30%
      // Also 3 rejections out of 4 = 75% rejection rate > 30%
      expect(analysis.highRiskSteps.length).toBeGreaterThan(0);
      const aiRisk = analysis.highRiskSteps.find(s => s.stepType === 'ai-analyze');
      expect(aiRisk).toBeDefined();
      expect(aiRisk!.reason).toMatch(/High (failure|rejection) rate/);
    });

    it('should extract top error patterns', async () => {
      const metrics = [
        {
          stepType: 'ai-analyze',
          status: 'failed',
          durationMs: 100,
          error: 'Timeout: request exceeded',
          timestamp: new Date(),
        },
        {
          stepType: 'ai-analyze',
          status: 'failed',
          durationMs: 100,
          error: 'Timeout: connection lost',
          timestamp: new Date(),
        },
        {
          stepType: 'create-task',
          status: 'failed',
          durationMs: 100,
          error: 'Validation: missing field',
          timestamp: new Date(),
        },
      ];
      mockObservability = makeMockObservability(metrics);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis = await loop.analyzeFeedbackPatterns({ days: 7 });

      expect(analysis.topErrorPatterns.length).toBeGreaterThan(0);
      const timeoutPattern = analysis.topErrorPatterns.find(p => p.pattern === 'Timeout');
      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern!.count).toBe(2);
    });

    it('should filter by workflowId when provided', async () => {
      const checkpoints = [
        { status: 'approved', stepType: 'create-task', stepName: 'A', stepId: 's1', rating: 4, createdAt: new Date() },
      ];
      mockPrisma = makeMockPrisma(checkpoints);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      await loop.analyzeFeedbackPatterns({ workflowId: 'wf-1', days: 7 });

      expect(mockPrisma.feedbackCheckpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            executionId: 'wf-1',
          }),
        }),
      );
    });
  });

  describe('generateRecommendations', () => {
    it('should return empty array when SOLO call fails', async () => {
      mockSoloBridge = makeMockSoloBridge(null, 'SOLO error');
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis: ImprovementAnalysis = {
        period: { start: new Date(), end: new Date() },
        totalCheckpoints: 10,
        approvalRate: 0.5,
        rejectionRate: 0.3,
        timeoutRate: 0.1,
        avgRating: 3.5,
        stepTypeStats: [],
        topErrorPatterns: [],
        highRiskSteps: [],
      };

      const recommendations = await loop.generateRecommendations(analysis);
      expect(recommendations).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should parse valid SOLO response into recommendations', async () => {
      const soloResponse = [
        {
          type: 'add_rule',
          targetStepType: 'ai-analyze',
          description: 'Add timeout rule for AI steps',
          confidence: 0.9,
          action: {
            triggerType: 'duration',
            triggerConfig: { thresholdMs: 30000 },
            action: 'notify',
            scopeStepType: 'ai-analyze',
          },
          reasoning: 'AI steps often timeout',
        },
      ];

      mockSoloBridge = makeMockSoloBridge(soloResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis: ImprovementAnalysis = {
        period: { start: new Date(), end: new Date() },
        totalCheckpoints: 10,
        approvalRate: 0.5,
        rejectionRate: 0.3,
        timeoutRate: 0.1,
        avgRating: 3.5,
        stepTypeStats: [],
        topErrorPatterns: [],
        highRiskSteps: [],
      };

      const recommendations = await loop.generateRecommendations(analysis);
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe('add_rule');
      expect(recommendations[0].confidence).toBe(0.9);
      expect(recommendations[0].description).toBe('Add timeout rule for AI steps');
      expect(recommendations[0].id).toBeDefined();
    });

    it('should extract JSON from text response', async () => {
      const textResponse = `Here are my recommendations:\n[{"type": "adjust_timeout", "description": "Increase timeout", "confidence": 0.8, "action": {}, "reasoning": "Often times out"}]\nThat's all.`;

      mockSoloBridge = makeMockSoloBridge(textResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis: ImprovementAnalysis = {
        period: { start: new Date(), end: new Date() },
        totalCheckpoints: 10,
        approvalRate: 0.5,
        rejectionRate: 0.3,
        timeoutRate: 0.1,
        avgRating: 3.5,
        stepTypeStats: [],
        topErrorPatterns: [],
        highRiskSteps: [],
      };

      const recommendations = await loop.generateRecommendations(analysis);
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe('adjust_timeout');
    });

    it('should clamp confidence to 0-1 range', async () => {
      const soloResponse = [
        { type: 'add_rule', description: 'Test', confidence: 1.5, action: {}, reasoning: 'Test' },
        { type: 'add_rule', description: 'Test2', confidence: -0.5, action: {}, reasoning: 'Test2' },
      ];

      mockSoloBridge = makeMockSoloBridge(soloResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis: ImprovementAnalysis = {
        period: { start: new Date(), end: new Date() },
        totalCheckpoints: 0,
        approvalRate: 0,
        rejectionRate: 0,
        timeoutRate: 0,
        avgRating: 0,
        stepTypeStats: [],
        topErrorPatterns: [],
        highRiskSteps: [],
      };

      const recommendations = await loop.generateRecommendations(analysis);
      expect(recommendations[0].confidence).toBe(1);
      expect(recommendations[1].confidence).toBe(0);
    });

    it('should default confidence to 0.5 when not provided', async () => {
      const soloResponse = [
        { type: 'add_rule', description: 'Test', action: {}, reasoning: 'Test' },
      ];

      mockSoloBridge = makeMockSoloBridge(soloResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis: ImprovementAnalysis = {
        period: { start: new Date(), end: new Date() },
        totalCheckpoints: 0,
        approvalRate: 0,
        rejectionRate: 0,
        timeoutRate: 0,
        avgRating: 0,
        stepTypeStats: [],
        topErrorPatterns: [],
        highRiskSteps: [],
      };

      const recommendations = await loop.generateRecommendations(analysis);
      expect(recommendations[0].confidence).toBe(0.5);
    });

    it('should default invalid type to add_rule', async () => {
      const soloResponse = [
        { type: 'invalid_type', description: 'Test', action: {}, reasoning: 'Test' },
      ];

      mockSoloBridge = makeMockSoloBridge(soloResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis: ImprovementAnalysis = {
        period: { start: new Date(), end: new Date() },
        totalCheckpoints: 0,
        approvalRate: 0,
        rejectionRate: 0,
        timeoutRate: 0,
        avgRating: 0,
        stepTypeStats: [],
        topErrorPatterns: [],
        highRiskSteps: [],
      };

      const recommendations = await loop.generateRecommendations(analysis);
      expect(recommendations[0].type).toBe('add_rule');
    });

    it('should handle single object response (not array)', async () => {
      const soloResponse = {
        type: 'add_retry',
        description: 'Add retry',
        confidence: 0.7,
        action: {},
        reasoning: 'Test',
      };

      mockSoloBridge = makeMockSoloBridge(soloResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const analysis: ImprovementAnalysis = {
        period: { start: new Date(), end: new Date() },
        totalCheckpoints: 0,
        approvalRate: 0,
        rejectionRate: 0,
        timeoutRate: 0,
        avgRating: 0,
        stepTypeStats: [],
        topErrorPatterns: [],
        highRiskSteps: [],
      };

      const recommendations = await loop.generateRecommendations(analysis);
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe('add_retry');
    });
  });

  describe('applyRecommendation', () => {
    it('should create feedback rule for add_rule type', async () => {
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const rec: ImprovementRecommendation = {
        id: 'rec-1',
        type: 'add_rule',
        targetStepType: 'ai-analyze',
        description: 'Add error rule',
        confidence: 0.9,
        action: {
          triggerType: 'error',
          triggerConfig: { errorPatterns: ['timeout'] },
          action: 'notify',
          scopeStepType: 'ai-analyze',
        },
        reasoning: 'AI steps timeout often',
      };

      const result = await loop.applyRecommendation({
        workflowId: 'wf-1',
        recommendation: rec,
      });

      expect(result.success).toBe(true);
      expect(result.applied).toContain('Created feedback rule');
      expect(mockPrisma.feedbackRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggerType: 'error',
            action: 'notify',
            scopeWorkflowId: 'wf-1',
            scopeStepType: 'ai-analyze',
            isActive: true,
            createdBy: 'solo',
          }),
        }),
      );
    });

    it('should handle add_rule failure', async () => {
      mockPrisma = makeMockPrisma();
      mockPrisma.feedbackRule.create = vi.fn().mockRejectedValue(new Error('DB error'));
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const rec: ImprovementRecommendation = {
        id: 'rec-1',
        type: 'add_rule',
        description: 'Add rule',
        confidence: 0.9,
        action: {},
        reasoning: 'Test',
      };

      const result = await loop.applyRecommendation({
        workflowId: 'wf-1',
        recommendation: rec,
      });

      expect(result.success).toBe(false);
      expect(result.applied).toContain('Failed to create feedback rule');
    });

    it('should log recommendation for non-add_rule types', async () => {
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const types: ImprovementRecommendation['type'][] = [
        'adjust_timeout', 'add_retry', 'change_feedback_mode', 'optimize_prompt', 'split_step',
      ];

      for (const type of types) {
        const rec: ImprovementRecommendation = {
          id: `rec-${type}`,
          type,
          description: `Test ${type}`,
          confidence: 0.8,
          action: {},
          reasoning: 'Test',
        };

        const result = await loop.applyRecommendation({
          workflowId: 'wf-1',
          recommendation: rec,
        });

        expect(result.success).toBe(true);
        expect(result.applied).toContain('requires orchestrator to apply');
      }
    });

    it('should return failure for unknown recommendation type', async () => {
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const rec: ImprovementRecommendation = {
        id: 'rec-1',
        type: 'add_rule', // valid type but we test the default case
        description: 'Test',
        confidence: 0.5,
        action: {},
        reasoning: 'Test',
      };

      // Force unknown type by casting
      const result = await loop.applyRecommendation({
        workflowId: 'wf-1',
        recommendation: { ...rec, type: 'unknown_type' as any },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('runImprovementCycle', () => {
    it('should run full cycle without auto-apply', async () => {
      const soloResponse = [
        { type: 'add_rule', description: 'Rule 1', confidence: 0.9, action: {}, reasoning: 'Test' },
      ];
      mockSoloBridge = makeMockSoloBridge(soloResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const result = await loop.runImprovementCycle({
        workflowId: 'wf-1',
        days: 7,
        autoApply: false,
      });

      expect(result.recommendations).toHaveLength(1);
      expect(result.appliedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.analysis).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should auto-apply high confidence recommendations', async () => {
      const soloResponse = [
        { type: 'add_rule', description: 'High confidence rule', confidence: 0.9, action: {
          triggerType: 'error', triggerConfig: {}, action: 'notify', scopeStepType: 'ai-analyze',
        }, reasoning: 'Test' },
        { type: 'add_rule', description: 'Low confidence rule', confidence: 0.5, action: {
          triggerType: 'error', triggerConfig: {}, action: 'notify', scopeStepType: 'ai-analyze',
        }, reasoning: 'Test' },
      ];
      mockSoloBridge = makeMockSoloBridge(soloResponse);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      const result = await loop.runImprovementCycle({
        workflowId: 'wf-1',
        days: 7,
        autoApply: true,
        minConfidence: 0.8,
      });

      expect(result.appliedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('should record improvement history', async () => {
      mockSoloBridge = makeMockSoloBridge([]);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      await loop.runImprovementCycle({ days: 7 });
      await loop.runImprovementCycle({ days: 7 });

      const history = loop.getImprovementHistory({});
      expect(history).toHaveLength(2);
    });

    it('should limit improvement history to 100 entries', async () => {
      mockSoloBridge = makeMockSoloBridge([]);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      for (let i = 0; i < 110; i++) {
        await loop.runImprovementCycle({ days: 7 });
      }

      const history = loop.getImprovementHistory({});
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should respect limit in getImprovementHistory', async () => {
      mockSoloBridge = makeMockSoloBridge([]);
      const loop = new ImprovementLoop(mockPrisma, mockSoloBridge, mockObservability, mockLogger);

      await loop.runImprovementCycle({ days: 7 });
      await loop.runImprovementCycle({ days: 7 });
      await loop.runImprovementCycle({ days: 7 });

      const history = loop.getImprovementHistory({ limit: 2 });
      expect(history).toHaveLength(2);
    });
  });
});
