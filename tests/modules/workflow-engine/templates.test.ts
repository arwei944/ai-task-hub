// ============================================================
// Project Workflow Templates Tests (Phase 6 - v2.0.0-beta.2)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  projectWorkflowTemplates,
  getTemplateForPhase,
  getAllTemplates,
  getSupportedPhases,
} from '@/lib/modules/workflow-engine/templates/project-templates';
import type { WorkflowTemplate, ProjectPhase } from '@/lib/modules/workflow-engine/templates/project-templates';

const expectedPhases: ProjectPhase[] = [
  'requirements',
  'planning',
  'architecture',
  'implementation',
  'testing',
  'deployment',
];

describe('Project Workflow Templates', () => {
  describe('all templates are defined', () => {
    it('should have templates for all expected phases', () => {
      for (const phase of expectedPhases) {
        expect(projectWorkflowTemplates[phase]).toBeDefined();
      }
    });

    it('should have exactly 6 templates', () => {
      expect(Object.keys(projectWorkflowTemplates)).toHaveLength(6);
    });

    it('getAllTemplates should return all templates', () => {
      const templates = getAllTemplates();
      expect(templates).toHaveLength(6);
    });

    it('getSupportedPhases should return all phases', () => {
      const phases = getSupportedPhases();
      expect(phases).toHaveLength(6);
      for (const phase of expectedPhases) {
        expect(phases).toContain(phase);
      }
    });
  });

  describe('template structure validation', () => {
    function validateTemplate(template: WorkflowTemplate, phase: ProjectPhase): void {
      expect(template.name).toBeTruthy();
      expect(typeof template.name).toBe('string');

      expect(template.description).toBeTruthy();
      expect(typeof template.description).toBe('string');

      expect(template.phase).toBe(phase);

      expect(Array.isArray(template.steps)).toBe(true);
      expect(template.steps.length).toBeGreaterThan(0);
    }

    it('requirements template has valid structure', () => {
      validateTemplate(projectWorkflowTemplates.requirements, 'requirements');
      expect(projectWorkflowTemplates.requirements.name).toBe('需求分析工作流');
    });

    it('planning template has valid structure', () => {
      validateTemplate(projectWorkflowTemplates.planning, 'planning');
      expect(projectWorkflowTemplates.planning.name).toBe('项目规划工作流');
    });

    it('architecture template has valid structure', () => {
      validateTemplate(projectWorkflowTemplates.architecture, 'architecture');
      expect(projectWorkflowTemplates.architecture.name).toBe('架构设计工作流');
    });

    it('implementation template has valid structure', () => {
      validateTemplate(projectWorkflowTemplates.implementation, 'implementation');
      expect(projectWorkflowTemplates.implementation.name).toBe('编码实现工作流');
    });

    it('testing template has valid structure', () => {
      validateTemplate(projectWorkflowTemplates.testing, 'testing');
      expect(projectWorkflowTemplates.testing.name).toBe('测试验证工作流');
    });

    it('deployment template has valid structure', () => {
      validateTemplate(projectWorkflowTemplates.deployment, 'deployment');
      expect(projectWorkflowTemplates.deployment.name).toBe('部署发布工作流');
    });
  });

  describe('template steps validation', () => {
    function validateSteps(template: WorkflowTemplate): void {
      for (const step of template.steps) {
        // Each step must have required fields
        expect(step.id).toBeTruthy();
        expect(typeof step.id).toBe('string');

        expect(step.name).toBeTruthy();
        expect(typeof step.name).toBe('string');

        expect(step.type).toBeTruthy();
        expect(typeof step.type).toBe('string');

        // Step type should be a known type
        const validTypes = [
          'create-task', 'update-status', 'ai-analyze', 'send-notification',
          'wait', 'parallel-group', 'condition', 'foreach', 'invoke-agent',
          'http-request', 'transform', 'approval',
        ];
        expect(validTypes).toContain(step.type);

        // Config should be an object
        expect(step.config).toBeDefined();
        expect(typeof step.config).toBe('object');
      }
    }

    it('requirements template steps have required fields', () => {
      validateSteps(projectWorkflowTemplates.requirements);
    });

    it('planning template steps have required fields', () => {
      validateSteps(projectWorkflowTemplates.planning);
    });

    it('architecture template steps have required fields', () => {
      validateSteps(projectWorkflowTemplates.architecture);
    });

    it('implementation template steps have required fields', () => {
      validateSteps(projectWorkflowTemplates.implementation);
    });

    it('testing template steps have required fields', () => {
      validateSteps(projectWorkflowTemplates.testing);
    });

    it('deployment template steps have required fields', () => {
      validateSteps(projectWorkflowTemplates.deployment);
    });
  });

  describe('getTemplateForPhase', () => {
    it('should return template for valid phase', () => {
      for (const phase of expectedPhases) {
        const template = getTemplateForPhase(phase);
        expect(template).toBeDefined();
        expect(template!.phase).toBe(phase);
      }
    });

    it('should return undefined for invalid phase', () => {
      const template = getTemplateForPhase('nonexistent');
      expect(template).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const template = getTemplateForPhase('');
      expect(template).toBeUndefined();
    });
  });

  describe('template content', () => {
    it('requirements template should include ai-analyze and create-task steps', () => {
      const types = projectWorkflowTemplates.requirements.steps.map(s => s.type);
      expect(types).toContain('ai-analyze');
      expect(types).toContain('create-task');
    });

    it('planning template should include reduce transform step', () => {
      const types = projectWorkflowTemplates.planning.steps.map(s => s.type);
      expect(types).toContain('transform');
      const transformStep = projectWorkflowTemplates.planning.steps.find(s => s.type === 'transform');
      expect(transformStep?.config.operation).toBe('reduce');
    });

    it('architecture template should include approval step', () => {
      const types = projectWorkflowTemplates.architecture.steps.map(s => s.type);
      expect(types).toContain('approval');
    });

    it('implementation template should include http-request step', () => {
      const types = projectWorkflowTemplates.implementation.steps.map(s => s.type);
      expect(types).toContain('http-request');
    });

    it('testing template should include http-request and transform steps', () => {
      const types = projectWorkflowTemplates.testing.steps.map(s => s.type);
      expect(types).toContain('http-request');
      expect(types).toContain('transform');
    });

    it('deployment template should include condition step', () => {
      const types = projectWorkflowTemplates.deployment.steps.map(s => s.type);
      expect(types).toContain('condition');
    });
  });
});
