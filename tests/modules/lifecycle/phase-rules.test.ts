import { describe, it, expect } from 'vitest';
import {
  PHASE_TRANSITION_RULES,
  getTransitionRule,
  isValidTransition,
  getValidNextPhases,
  isValidPhase,
  getPhaseIndex,
} from '@/lib/modules/lifecycle/phase-rules';
import { PHASES } from '@/lib/modules/lifecycle/types';

describe('Phase Rules', () => {
  // ================================================================
  // All transition rules are defined
  // ================================================================

  describe('PHASE_TRANSITION_RULES', () => {
    it('should define 6 transition rules', () => {
      expect(PHASE_TRANSITION_RULES).toHaveLength(6);
    });

    it('should have rules for all phase transitions in order', () => {
      const expectedTransitions = [
        { from: 'requirements', to: 'planning' },
        { from: 'planning', to: 'architecture' },
        { from: 'architecture', to: 'implementation' },
        { from: 'implementation', to: 'testing' },
        { from: 'testing', to: 'deployment' },
        { from: 'deployment', to: 'completed' },
      ];

      for (const expected of expectedTransitions) {
        const rule = getTransitionRule(expected.from, expected.to);
        expect(rule).toBeDefined();
        expect(rule!.from).toBe(expected.from);
        expect(rule!.to).toBe(expected.to);
      }
    });

    it('each rule should have conditions, autoActions, and requireApproval', () => {
      for (const rule of PHASE_TRANSITION_RULES) {
        expect(rule.conditions).toBeInstanceOf(Array);
        expect(rule.conditions.length).toBeGreaterThan(0);
        expect(rule.autoActions).toBeInstanceOf(Array);
        expect(rule.autoActions.length).toBeGreaterThan(0);
        expect(typeof rule.requireApproval).toBe('boolean');
      }
    });

    it('should have correct approval requirements', () => {
      const approvalMap: Record<string, boolean> = {
        'requirements->planning': true,
        'planning->architecture': true,
        'architecture->implementation': true,
        'implementation->testing': false,
        'testing->deployment': true,
        'deployment->completed': false,
      };

      for (const rule of PHASE_TRANSITION_RULES) {
        const key = `${rule.from}->${rule.to}`;
        expect(rule.requireApproval).toBe(approvalMap[key]);
      }
    });
  });

  // ================================================================
  // Phase order validation
  // ================================================================

  describe('Phase order', () => {
    it('PHASES should have 7 phases in correct order', () => {
      expect(PHASES).toHaveLength(7);
      expect(PHASES[0]).toBe('requirements');
      expect(PHASES[1]).toBe('planning');
      expect(PHASES[2]).toBe('architecture');
      expect(PHASES[3]).toBe('implementation');
      expect(PHASES[4]).toBe('testing');
      expect(PHASES[5]).toBe('deployment');
      expect(PHASES[6]).toBe('completed');
    });

    it('getPhaseIndex should return correct indices', () => {
      expect(getPhaseIndex('requirements')).toBe(0);
      expect(getPhaseIndex('planning')).toBe(1);
      expect(getPhaseIndex('architecture')).toBe(2);
      expect(getPhaseIndex('implementation')).toBe(3);
      expect(getPhaseIndex('testing')).toBe(4);
      expect(getPhaseIndex('deployment')).toBe(5);
      expect(getPhaseIndex('completed')).toBe(6);
    });

    it('getPhaseIndex should return -1 for invalid phase', () => {
      expect(getPhaseIndex('invalid')).toBe(-1);
      expect(getPhaseIndex('')).toBe(-1);
    });

    it('each transition should go forward in phase order', () => {
      for (const rule of PHASE_TRANSITION_RULES) {
        const fromIdx = getPhaseIndex(rule.from);
        const toIdx = getPhaseIndex(rule.to);
        expect(toIdx).toBeGreaterThan(fromIdx);
      }
    });
  });

  // ================================================================
  // isValidTransition
  // ================================================================

  describe('isValidTransition', () => {
    it('should return true for valid sequential transitions', () => {
      expect(isValidTransition('requirements', 'planning')).toBe(true);
      expect(isValidTransition('planning', 'architecture')).toBe(true);
      expect(isValidTransition('architecture', 'implementation')).toBe(true);
      expect(isValidTransition('implementation', 'testing')).toBe(true);
      expect(isValidTransition('testing', 'deployment')).toBe(true);
      expect(isValidTransition('deployment', 'completed')).toBe(true);
    });

    it('should return false for backward transitions', () => {
      expect(isValidTransition('planning', 'requirements')).toBe(false);
      expect(isValidTransition('testing', 'implementation')).toBe(false);
      expect(isValidTransition('completed', 'deployment')).toBe(false);
    });

    it('should return false for skipping phases', () => {
      expect(isValidTransition('requirements', 'architecture')).toBe(false);
      expect(isValidTransition('requirements', 'implementation')).toBe(false);
      expect(isValidTransition('planning', 'testing')).toBe(false);
      expect(isValidTransition('requirements', 'completed')).toBe(false);
    });

    it('should return false for same phase', () => {
      expect(isValidTransition('requirements', 'requirements')).toBe(false);
      expect(isValidTransition('testing', 'testing')).toBe(false);
    });

    it('should return false for invalid phases', () => {
      expect(isValidTransition('invalid', 'planning')).toBe(false);
      expect(isValidTransition('requirements', 'invalid')).toBe(false);
      expect(isValidTransition('', '')).toBe(false);
    });
  });

  // ================================================================
  // getValidNextPhases
  // ================================================================

  describe('getValidNextPhases', () => {
    it('should return correct next phases for each phase', () => {
      expect(getValidNextPhases('requirements')).toEqual(['planning']);
      expect(getValidNextPhases('planning')).toEqual(['architecture']);
      expect(getValidNextPhases('architecture')).toEqual(['implementation']);
      expect(getValidNextPhases('implementation')).toEqual(['testing']);
      expect(getValidNextPhases('testing')).toEqual(['deployment']);
      expect(getValidNextPhases('deployment')).toEqual(['completed']);
      expect(getValidNextPhases('completed')).toEqual([]);
    });

    it('should return empty for invalid phase', () => {
      expect(getValidNextPhases('invalid')).toEqual([]);
      expect(getValidNextPhases('')).toEqual([]);
    });
  });

  // ================================================================
  // isValidPhase
  // ================================================================

  describe('isValidPhase', () => {
    it('should return true for all valid phases', () => {
      for (const phase of PHASES) {
        expect(isValidPhase(phase)).toBe(true);
      }
    });

    it('should return false for invalid phases', () => {
      expect(isValidPhase('invalid')).toBe(false);
      expect(isValidPhase('')).toBe(false);
      expect(isValidPhase('Requirements')).toBe(false); // case sensitive
      expect(isValidPhase('REQUIREMENTS')).toBe(false);
    });
  });

  // ================================================================
  // getTransitionRule
  // ================================================================

  describe('getTransitionRule', () => {
    it('should return the rule for a valid transition', () => {
      const rule = getTransitionRule('requirements', 'planning');
      expect(rule).toBeDefined();
      expect(rule!.conditions).toContain('至少1个已确认需求');
      expect(rule!.requireApproval).toBe(true);
    });

    it('should return undefined for invalid transition', () => {
      const rule = getTransitionRule('invalid', 'planning');
      expect(rule).toBeUndefined();
    });
  });
});
