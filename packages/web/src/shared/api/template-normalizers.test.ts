import { describe, expect, it } from 'vitest';
import { normalizeTemplate, toTemplateApiPayload } from './client';

describe('template API mapping', () => {
  it('normalizes camelCase template responses for settings UI', () => {
    expect(
      normalizeTemplate({
        id: 'template-1',
        name: 'Expert',
        type: 'post',
        systemPrompt: 'system text',
        userPrompt: '{{content}}',
        isDefault: true,
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-02T10:00:00.000Z',
      })
    ).toEqual({
      id: 'template-1',
      name: 'Expert',
      type: 'post',
      system_prompt: 'system text',
      user_prompt: '{{content}}',
      is_default: true,
      created_at: '2026-05-01T10:00:00.000Z',
      updated_at: '2026-05-02T10:00:00.000Z',
    });
  });

  it('sends prompt edits with backend field names', () => {
    expect(
      toTemplateApiPayload({
        system_prompt: 'new system',
        user_prompt: 'new user',
        is_default: false,
      })
    ).toEqual({
      systemPrompt: 'new system',
      userPrompt: 'new user',
      isDefault: false,
    });
  });
});
