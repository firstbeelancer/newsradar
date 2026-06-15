import { describe, expect, it } from 'vitest';
import { ALL_AGENTS_COLLECT_VALUE, resolveCollectTarget } from './agent-collect-dialog';

describe('resolveCollectTarget', () => {
  it('maps the default all-agents selection to the collect-all target', () => {
    expect(resolveCollectTarget(ALL_AGENTS_COLLECT_VALUE)).toBeNull();
  });

  it('keeps a concrete agent id for a single-agent collection', () => {
    expect(resolveCollectTarget('agent-1')).toBe('agent-1');
  });
});
