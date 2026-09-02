import { describe, expect, it } from 'vitest';
import {
  buildAgentFormPayload,
  buildAgentTags,
  buildSettingsAgentCreatePayload,
} from './agent-tags';

describe('agent tag helpers', () => {
  it('includes the pending tag input when building agent tags', () => {
    expect(buildAgentTags(['ai'], ' Gemini,  OpenRouter ')).toEqual(['ai', 'gemini', 'openrouter']);
  });

  it('deduplicates tags case-insensitively', () => {
    expect(buildAgentTags(['AI', 'gemini'], 'ai, Gemini, security')).toEqual(['ai', 'gemini', 'security']);
  });

  it('preserves full agent config when creating from settings', () => {
    expect(
      buildSettingsAgentCreatePayload(
        {
          name: 'AI',
          description: 'AI news',
          icon: 'brain',
          color: '#8b5cf6',
          subjectArea: 'ai',
          config: {
            tags: ['gemini'],
            systemPrompt: 'system',
          },
        },
        3
      )
    ).toEqual({
      name: 'AI',
      description: 'AI news',
      icon: 'brain',
      color: '#8b5cf6',
      subjectArea: 'ai',
      config: {
        tags: ['gemini'],
        systemPrompt: 'system',
      },
      position: 3,
    });
  });
});

describe('buildAgentFormPayload', () => {
  const base = {
    name: '  DevOps  ',
    description: ' infra news ',
    icon: 'server',
    color: '#0ea5e9',
    subjectArea: 'devops',
    targetAudience: '',
    tone: ' professional ',
    systemPrompt: '',
    tags: ['kubernetes', 'terraform'],
    tagInput: '',
    scoringWeights: { relevance: 40, novelty: 20, hype: 15, practical: 15, local: 10 },
  };

  it('sends an empty tag array when the user cleared every tag', () => {
    // `undefined` would be dropped from the JSON body, and the backend merges
    // config — so the old tags survived and scoring kept using them.
    const payload = buildAgentFormPayload({ ...base, tags: [], tagInput: '' });

    expect(payload.config?.tags).toEqual([]);
    expect(payload.config).toHaveProperty('tags');
  });

  it('folds the pending tag input into the saved tags', () => {
    const payload = buildAgentFormPayload({ ...base, tagInput: 'Ansible' });

    expect(payload.config?.tags).toEqual(['kubernetes', 'terraform', 'ansible']);
  });

  it('carries the scoring weight matrix through untouched', () => {
    expect(buildAgentFormPayload(base).config?.scoringWeights).toEqual(base.scoringWeights);
  });

  it('trims the display fields', () => {
    const payload = buildAgentFormPayload(base);

    expect(payload.name).toBe('DevOps');
    expect(payload.description).toBe('infra news');
    expect(payload.config?.tone).toBe('professional');
  });
});
