import { describe, expect, it } from 'vitest';
import { buildAgentTags, buildSettingsAgentCreatePayload } from './agent-tags';

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
