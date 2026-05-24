import { describe, expect, it } from 'vitest';
import { parseScoreModifierInput } from '../src/features/agents/agent-form';
import { composeRegenerationPrompt } from '../src/features/generation/generation-result';
import { buildGenerateDigestRequest } from '../src/shared/stores/generation-store';

describe('generation workflow helpers', () => {
  it('includes editor feedback and current draft in regeneration prompt', () => {
    const prompt = composeRegenerationPrompt('add tags and source links', 'Current draft body');

    expect(prompt).toContain('add tags and source links');
    expect(prompt).toContain('Current draft body');
    expect(prompt.toLowerCase()).toContain('mandatory');
  });

  it('omits empty agent id when digest is generated from selected articles', () => {
    const request = buildGenerateDigestRequest(
      {
        selectedArticleIds: ['article-1', 'article-2'],
        selectedAgentId: null,
        selectedPeriod: 'day',
        selectedTemplateId: null,
        selectedProvider: 'openrouter',
        selectedModel: 'openrouter/auto',
        lastDigestRequest: null,
      },
      undefined
    );

    expect(request.agent_id).toBeUndefined();
    expect(request.article_ids).toEqual(['article-1', 'article-2']);
  });

  it('accepts comma decimals for chip filter score modifiers', () => {
    expect(parseScoreModifierInput('0,15')).toBe(0.15);
    expect(parseScoreModifierInput('-0,05')).toBe(-0.05);
  });
});
