import { describe, expect, test } from 'bun:test';

import {
  assertAgentRegistryValid,
  validateAgentRegistry,
} from '../src/agents/validate-registry.js';

describe('validateAgentRegistry', () => {
  test('in-tree agents, skills, and tools pass validation', () => {
    const issues = validateAgentRegistry();
    const errors = issues.filter((i) => i.level === 'error');
    if (errors.length > 0) {
      console.error(errors.map((e) => e.message).join('\n'));
    }
    expect(errors).toEqual([]);
  });

  test('assertAgentRegistryValid does not throw for the shipped registry', () => {
    expect(() => assertAgentRegistryValid()).not.toThrow();
  });

  test('productivity_attendant wires autonomous-scheduler and run_command', () => {
    const issues = validateAgentRegistry();
    const errors = issues.filter(
      (i) => i.level === 'error' && i.agentId === 'productivity_attendant',
    );
    expect(errors).toEqual([]);

    const skillIssue = issues.find(
      (i) => i.agentId === 'productivity_attendant' && i.skill === 'autonomous-scheduler',
    );
    expect(skillIssue?.level).not.toBe('error');
  });
});
